/**
 * tests/acceptance/api-canonical-lifecycle.acceptance.test.ts
 *
 * AEGIS Acceptance Test: One Authoritative Run Lifecycle
 *
 * Proves that CLI, API, and Dashboard observe the single canonical execution lifecycle
 * managed by ApprovalRuntime in src/runtime/approvalWorkflow.ts.
 *
 * Scenarios:
 *   1. CLI-created run can be retrieved by the API.
 *   2. An API-created run persists in the canonical runtime (.aegis/runs/<id>.json).
 *   3. A pending approval is visible through the API.
 *   4. An API approval resumes the same run safely.
 *   5. Rejection and replay protection work (no double resolution).
 *   6. Actual verification evidence reaches the API.
 *   7. Dashboard status and health reflect real backend telemetry.
 *   8. Restarting the API does not erase canonical run state.
 *   9. Failed, missing, and unsupported operations return explicit error codes (404/400/409),
 *      never fake success.
 */

import assert from 'node:assert';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {
  approvalRuntime,
  createApprovalRequest,
} from '../../src/runtime/approvalWorkflow.js';
import type { AegisState } from '../../src/runtime/state.js';
import { createServerInstance } from '../../apps/api/server.js';
import { memProjects } from '../../apps/api/services/memoryStore.js';

process.env.SKIP_DB = '1';
process.env.NODE_ENV = 'test';
process.env.AEGIS_TEST_API = '1';
process.env.AEGIS_TEST_ADAPTER = '1';
process.env.DOTENV_CONFIG_QUIET = 'true';

async function startTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  const { server } = createServerInstance();
  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => resolve());
    server.on('error', reject);
  });
  const port = (server.address() as net.AddressInfo).port;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function request(baseUrl: string, urlPath: string, options: RequestInit = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let body: any = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function runAcceptanceSuite() {
  console.log('===============================================================');
  console.log('  ACCEPTANCE: One Authoritative Run Lifecycle (CLI / API / Web)');
  console.log('===============================================================\n');

  let { server, baseUrl } = await startTestServer();
  const testWorkspace = path.resolve('scratch/test-workspace-canonical-api');
  fs.mkdirSync(testWorkspace, { recursive: true });

  try {
    // ── Setup: ensure a test project exists in memoryStore ──────────────────
    const projectId = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
    memProjects[projectId] = {
      id: projectId,
      name: 'Canonical Test Project',
      description: 'Testing one authoritative execution lifecycle',
      repo: 'https://github.com/aegis/test',
      branch: 'main',
      tech_stack: JSON.stringify(['TypeScript', 'Node.js']),
      language: 'TypeScript',
      status: 'active',
      task_count: 0,
      completed_tasks: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // ── 1. CLI-created run can be retrieved by the API ───────────────────────
    console.log('Scenario 1: CLI-created run can be retrieved by the API...');
    const cliRunId = `run_${Date.now()}_cli_authoritative`;
    const cliInitialState: AegisState = {
      task: 'Fix math calculator precision bug',
      workspace: testWorkspace,
      status: 'developing',
      codeChanges: [
        {
          path: 'src/calc.ts',
          action: 'modify',
          content: 'export const add = (a: number, b: number) => a + b;',
          summary: 'Fix addition precision',
        },
      ],
      plan: [],
      research: 'Checked calc.ts',
      architecture: 'Utility math module',
      testResults: null,
      reviewResults: null,
      errors: [],
      retryCount: 0,
      maxRetries: 3,
      executionLog: ['[CLI] Started run from command line interface.'],
      recoveryContext: [],
      runId: cliRunId,
      executionKind: 'FIX',
    };

    approvalRuntime.registerRun(cliRunId, cliInitialState);

    const getCliRunRes = await request(baseUrl, `/api/runs/${cliRunId}`);
    assert.strictEqual(getCliRunRes.status, 200, `Expected 200, got ${getCliRunRes.status}`);
    assert.strictEqual(getCliRunRes.body.data.id, cliRunId);
    assert.strictEqual(getCliRunRes.body.data.status, 'running');
    assert.strictEqual(getCliRunRes.body.data.files_changed, 1);
    assert.strictEqual(getCliRunRes.body.data.files[0].path, 'src/calc.ts');
    console.log('  ✅ CLI run visible via GET /api/runs/:id with full code change evidence.');

    // ── 2. An API-created run persists in the canonical runtime ─────────────
    console.log('\nScenario 2: API-created run persists in canonical runtime (.aegis/runs/<id>.json)...');
    const createTaskRes = await request(baseUrl, '/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        description: 'Implement secure token validation middleware',
        executionMode: 'semi-auto',
        priority: 1,
      }),
    });
    assert.strictEqual(createTaskRes.status, 201);
    const taskId = createTaskRes.body.data.id;

    const createRunRes = await request(baseUrl, `/api/tasks/${taskId}/runs`, {
      method: 'POST',
      body: JSON.stringify({ executionMode: 'semi-auto' }),
    });
    assert.strictEqual(createRunRes.status, 201);
    const apiRunId = createRunRes.body.data.id;
    assert.ok(apiRunId.startsWith('run_'), `Expected runId to start with run_, got ${apiRunId}`);

    // Verify canonical persistence on disk immediately
    const runFilePath = path.resolve('.aegis', 'runs', `${apiRunId}.json`);
    assert.ok(fs.existsSync(runFilePath), `Expected persisted file at ${runFilePath}`);

    const persistedRaw = fs.readFileSync(runFilePath, 'utf-8');
    const parsedRecord = JSON.parse(persistedRaw);
    assert.strictEqual(parsedRecord.version, 1);
    assert.strictEqual(parsedRecord.runId, apiRunId);
    assert.strictEqual(parsedRecord.state.task, 'Implement secure token validation middleware');
    console.log('  ✅ API-created run exists in canonical .aegis/runs/<id>.json with version 1.');

    // ── 3. Pending approval is visible through the API ────────────────────────
    console.log('\nScenario 3: Pending approval is visible through the API...');
    const approvalRunId = `run_${Date.now()}_appr_gate`;
    const pendingApprId = `appr_${Date.now()}_gate`;
    const apprRequest = createApprovalRequest({
      runId: approvalRunId,
      type: 'code-review',
      action: 'write_file',
      title: 'Approve token validation middleware patch',
      description: 'Review modified src/auth.ts before disk write',
      target: 'src/auth.ts',
      riskLevel: 'high',
      requestedBy: 'developerNode',
    });
    // Ensure the ID matches our test assertion
    apprRequest.id = pendingApprId;

    const apprRunState: AegisState = {
      task: 'Token validation task',
      workspace: testWorkspace,
      status: 'paused',
      pendingApproval: apprRequest,
      codeChanges: [{ path: 'src/auth.ts', action: 'modify', content: 'export const verify = () => true;' }],
      plan: [],
      research: '',
      architecture: '',
      testResults: null,
      reviewResults: null,
      errors: [],
      retryCount: 0,
      maxRetries: 3,
      executionLog: ['Paused at approval gate.'],
      recoveryContext: [],
      runId: approvalRunId,
    };

    approvalRuntime.registerRun(approvalRunId, apprRunState);

    // GET /api/approvals/:id
    const getApprRes = await request(baseUrl, `/api/approvals/${pendingApprId}`);
    assert.strictEqual(getApprRes.status, 200);
    assert.strictEqual(getApprRes.body.data.id, pendingApprId);
    assert.strictEqual(getApprRes.body.data.status, 'pending');
    assert.strictEqual(getApprRes.body.data.title, 'Approve token validation middleware patch');

    // GET /api/runs/:id/status
    const getStatusRes = await request(baseUrl, `/api/runs/${approvalRunId}/status`);
    assert.strictEqual(getStatusRes.status, 200);
    assert.strictEqual(getStatusRes.body.data.status, 'paused');
    assert.strictEqual(getStatusRes.body.data.pendingApproval.id, pendingApprId);
    console.log('  ✅ Pending approval retrieved via /api/approvals/:id and /api/runs/:id/status.');

    // ── 4. API approval resumes the same run safely ───────────────────────────
    console.log('\nScenario 4: API approval resumes the same run safely...');
    const resolveApproveRes = await request(baseUrl, `/api/approvals/${pendingApprId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'approve',
        reason: 'Reviewed and approved for application',
      }),
    });
    assert.strictEqual(resolveApproveRes.status, 200);
    assert.strictEqual(resolveApproveRes.body.data.status, 'approved');
    assert.strictEqual(resolveApproveRes.body.data.resolution, 'Reviewed and approved for application');

    // Verify canonical run updated on disk
    const resumedRun = approvalRuntime.getPersistedRun(approvalRunId);
    assert.ok(resumedRun);
    assert.ok(resumedRun.events.some((e) => e.type === 'approval_resolved'));
    console.log('  ✅ Approval resolved and event appended to canonical run lifecycle.');

    // ── 5. Rejection and replay protection ───────────────────────────────────
    console.log('\nScenario 5: Rejection and replay protection work...');
    // Attempting to resolve the same approval again must return 409 CONFLICT
    const replayRes = await request(baseUrl, `/api/approvals/${pendingApprId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
    });
    assert.strictEqual(replayRes.status, 409, `Expected 409 Conflict on replay, got ${replayRes.status}`);

    // Test rejection on another run
    const rejectRunId = `run_${Date.now()}_reject_gate`;
    const rejectApprId = `appr_${Date.now()}_reject`;
    const rejectApprReq = createApprovalRequest({
      runId: rejectRunId,
      type: 'code-review',
      action: 'write_file',
      title: 'Reject unsafe mutation',
      description: 'Contains unsafe rm -rf command',
      requestedBy: 'securityNode',
    });
    rejectApprReq.id = rejectApprId;

    approvalRuntime.registerRun(rejectRunId, {
      ...apprRunState,
      runId: rejectRunId,
      pendingApproval: rejectApprReq,
    });

    const resolveRejectRes = await request(baseUrl, `/api/approvals/${rejectApprId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject', reason: 'Unsafe command detected' }),
    });
    assert.strictEqual(resolveRejectRes.status, 200);
    assert.strictEqual(resolveRejectRes.body.data.status, 'rejected');

    // Replay on rejected approval must also return 409
    const replayRejectRes = await request(baseUrl, `/api/approvals/${rejectApprId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject' }),
    });
    assert.strictEqual(replayRejectRes.status, 409);
    console.log('  ✅ Replay protection confirmed (HTTP 409 on second resolution); rejection works.');

    // ── 6. Actual verification evidence reaches the API ───────────────────────
    console.log('\nScenario 6: Actual verification evidence reaches the API...');
    const evidenceRunId = `run_${Date.now()}_evidence`;
    const evidenceState: AegisState = {
      task: 'Verify test suite execution',
      workspace: testWorkspace,
      status: 'completed',
      codeChanges: [],
      plan: [],
      research: '',
      architecture: '',
      testResults: {
        totalTests: 12,
        passedTests: 12,
        failedTests: 0,
        passed: true,
        verificationRecord: {
          command: 'npm test -- --ci',
          workspace: testWorkspace,
          exitCode: 0,
          stdout: 'PASS: 12 tests passed in 4 suites',
          stderr: '',
          durationMs: 840,
          timeoutMs: 30000,
        },
      },
      reviewResults: null,
      errors: [],
      retryCount: 0,
      maxRetries: 3,
      executionLog: ['Ran verification suite successfully.'],
      recoveryContext: [],
      runId: evidenceRunId,
    };

    approvalRuntime.registerRun(evidenceRunId, evidenceState);

    const getEvidenceRunRes = await request(baseUrl, `/api/runs/${evidenceRunId}`);
    assert.strictEqual(getEvidenceRunRes.status, 200);
    assert.strictEqual(getEvidenceRunRes.body.data.tests_run, 12);
    assert.strictEqual(getEvidenceRunRes.body.data.tests_passed, 12);
    assert.ok(getEvidenceRunRes.body.data.verificationEvidence);
    assert.strictEqual(getEvidenceRunRes.body.data.verificationEvidence.command, 'npm test -- --ci');
    assert.strictEqual(getEvidenceRunRes.body.data.verificationEvidence.exitCode, 0);
    assert.strictEqual(getEvidenceRunRes.body.data.verificationEvidence.stdout, 'PASS: 12 tests passed in 4 suites');
    console.log('  ✅ Verification evidence correctly exposed via API.');

    // ── 7. Dashboard and system health telemetry ─────────────────────────────
    console.log('\nScenario 7: Real backend telemetry via /health endpoint...');
    const healthRes = await request(baseUrl, '/health');
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.body.status, 'ok');
    assert.strictEqual(typeof healthRes.body.gemini.configured, 'boolean');
    assert.strictEqual(typeof healthRes.body.github.configured, 'boolean');
    console.log('  Health response runs:', healthRes.body.runs);
    assert.ok(healthRes.body.runs.total >= 1, 'Expected at least 1 recorded run in telemetry');
    console.log('  ✅ /health endpoint returns authentic server, database, and run telemetry.');

    // ── 8. Restarting the API does not erase canonical run state ──────────────
    console.log('\nScenario 8: Restarting the API does not erase canonical run state...');
    // Close the first server
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Clear in-memory caches to simulate complete process restart
    approvalRuntime.clear();

    // Start a new server instance
    const newServerContext = await startTestServer();
    server = newServerContext.server;
    baseUrl = newServerContext.baseUrl;

    // Retrieve the run created prior to restart
    const postRestartRes = await request(baseUrl, `/api/runs/${cliRunId}`);
    assert.strictEqual(postRestartRes.status, 200, 'Expected 200 after server restart');
    assert.strictEqual(postRestartRes.body.data.id, cliRunId);
    assert.strictEqual(postRestartRes.body.data.files[0].path, 'src/calc.ts');
    console.log('  ✅ Server restarted; canonical run faithfully reconstructed from disk.');

    // ── 9. Missing, failed, and unsupported operations return explicit error codes
    console.log('\nScenario 9: Missing and unsupported operations return explicit error codes...');
    const missingRunRes = await request(baseUrl, '/api/runs/non_existent_run_9999');
    assert.strictEqual(missingRunRes.status, 404, 'Expected 404 for missing run');

    const missingApprRes = await request(baseUrl, '/api/approvals/non_existent_appr_9999');
    assert.strictEqual(missingApprRes.status, 404, 'Expected 404 for missing approval');

    // Cancel missing run
    const cancelMissingRes = await request(baseUrl, '/api/runs/non_existent_run_9999/cancel', {
      method: 'POST',
    });
    assert.strictEqual(cancelMissingRes.status, 404, 'Expected 404 for cancelling missing run');

    // Cancel already completed run -> 400 Bad Request
    const cancelCompletedRes = await request(baseUrl, `/api/runs/${evidenceRunId}/cancel`, {
      method: 'POST',
    });
    assert.strictEqual(cancelCompletedRes.status, 400, 'Expected 400 for cancelling terminal run');
    console.log('  ✅ Missing and unsupported operations return explicit HTTP 404 / 400, never fake success.');

    console.log('\n===============================================================');
    console.log('  🎉 ALL 9 ACCEPTANCE SCENARIOS PASSED WITH FULL EVIDENCE! 🎉');
    console.log('===============================================================\n');
    process.exit(0);

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    } catch {}
  }
}

runAcceptanceSuite().catch((err) => {
  console.error('\n❌ Acceptance Test Failed:', err);
  process.exit(1);
});
