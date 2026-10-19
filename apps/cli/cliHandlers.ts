
let lastTimestamp = 0;
export function generateRunId(): string {
  let now = Date.now();
  if (now <= lastTimestamp) {
    now = lastTimestamp + 1;
  }
  lastTimestamp = now;
  return `run_${now}`;
}

import { assembleGroundedContext } from '../../src/context/groundedContext.js';
import path from 'path';
import fs from 'fs';
import { validateRepositoryAccess, createRepositoryIdentity } from '../../src/intelligence/connection/connectionManager.js';
import { ingestRemoteRepository } from '../../src/intelligence/connection/remoteIngestion.js';
import { scanRepositoryDirectory } from '../../src/intelligence/scanner/fileScanner.js';
import { parseTypeScriptSymbols } from '../../src/intelligence/parsers/tsParser.js';
import { extractImportExports } from '../../src/intelligence/extractors/importExportExtractor.js';
import { extractDependencies } from '../../src/intelligence/extractors/dependencyExtractor.js';
import { extractApiRoutes } from '../../src/intelligence/extractors/apiExtractor.js';
import { extractDatabaseModels } from '../../src/intelligence/extractors/databaseExtractor.js';
import { extractTests } from '../../src/intelligence/extractors/testExtractor.js';
import { analyzeGitHistory } from '../../src/intelligence/git/gitAnalyzer.js';
import { buildRelationshipGraph } from '../../src/intelligence/relationships/graphEngine.js';
import { JsonRepositoryStore } from '../../src/intelligence/storage/jsonStore.js';
import { RepositorySnapshot, SymbolRecord, ImportExportRecord } from '../../src/intelligence/types.js';
import { queryRepositoryIntelligence, getRepositoryStatus } from '../../src/intelligence/retrieval/hybridRetriever.js';
import {
  executeApprovalWorkflow,
  resolveApprovalAndResume,
  approvalRuntime,
  buildApprovalWorkflow,
  NativeAgentRunRecord,
} from '../../src/runtime/approvalWorkflow.js';
import type { AegisState, AegisStateUpdate, CodeChange, VerificationRecord } from '../../src/runtime/state.js';
import { runToolAgent, AgentModel } from '../../src/agent/agent.js';
import {
  createInvestigationTools,
  createRepositoryIntelligenceTool,
  validateSourceEvidence,
  SourceEvidence,
  getWorkspaceRevision,
} from '../../src/tools/investigation/index.js';
import { findMatchingRepoSnapshot } from '../../src/intelligence/retrieval/hybridRetriever.js';
import type { Content, FunctionDeclaration } from '@google/genai';
import { z } from 'zod';
import { createAegisTool } from '../../src/tools/types.js';
import { runCommand, isEnvironmentOrSetupFailure } from '../../src/tools/terminal/index.js';
import {
  renderPatchPreview,
  renderMarkdown,
  renderVerificationReport,
  renderRunStatusReport,
  promptUser,
  style,
} from './cliPresentation.js';

const store = new JsonRepositoryStore();

// ── Native Repair Implementation ─────────────────────────────────────────────

export async function executeNativeRepair(
  runId: string,
  workspace: string,
  goal: string,
  failedChanges: CodeChange[],
  verification: VerificationRecord,
  retryCount: number
): Promise<CodeChange[]> {
  const proposals: CodeChange[] = [];
  const tools = [
    ...createInvestigationTools(workspace),
    createProposalTool(proposals, workspace),
  ];
  const model = getInvestigationModel('fix');

  const failurePrompt =
    `Verification failed after applying previous proposed changes (repair revision attempt ${retryCount}).\n` +
    `Goal: ${goal}\n` +
    `Executed Command: ${verification.command}\n` +
    `Exit Code: ${verification.exitCode}\n` +
    `Output:\n${verification.stdout}\n${verification.stderr}\n\n` +
    `Previous applied changes that failed:\n` +
    failedChanges.map((c) => `- ${c.action} ${c.path}`).join('\n') + '\n\n' +
    `Investigate the failure, read current files in the workspace, and propose a corrective revision using propose_file_change. ` +
    `Do not propose the exact same failing change.`;

  const groundedContext = assembleGroundedContext({
    workspace,
    goal,
    executionKind: 'REPAIR',
  });

  await runToolAgent(
    failurePrompt,
    tools,
    {},
    {
      model,
      groundedContext,
      maxIterations: 10,
      maxToolCalls: 24,
      timeoutMs: 60_000,
      onToolExecution: (record) => {
        console.log(`  [${record.policyDecision}] ${record.name} (${record.durationMs}ms)`);
        approvalRuntime.appendNativeAgentToolCall(runId, record);
      },
    }
  );

  if (proposals.length > 0) {
    const isIdentical = proposals.every((p) =>
      failedChanges.some((f) => f.path === p.path && f.content === p.content && f.action === p.action)
    );
    if (isIdentical) {
      console.warn('[NATIVE-REPAIR] Agent proposed identical changes that already failed verification.');
      return [];
    }
  }

  return proposals;
}

approvalRuntime.setRepairHandler(async (context) => {
  return executeNativeRepair(
    context.runId,
    context.workspace,
    context.goal,
    context.failedChanges,
    context.verification,
    context.retryCount
  );
});

// ── Test Adapter & Helper Factories ──────────────────────────────────────────

export function getCliWorkflow() {
  if (process.env.AEGIS_TEST_ADAPTER !== '1') {
    return undefined;
  }

  const changePath = process.env.AEGIS_TEST_CHANGE_PATH || 'src/aegis-test.txt';
  const changeContent = process.env.AEGIS_TEST_CHANGE_CONTENT || 'authorized-change\n';
  const changeAction = process.env.AEGIS_TEST_CHANGE_ACTION === 'modify' ? 'modify' : 'add';
  const deterministicUpdate = (status: AegisState['status']): AegisStateUpdate => ({ status });

  return buildApprovalWorkflow({
    planner: async () => ({
      ...deterministicUpdate('planning'),
      plan: [{
        id: 'test-plan',
        title: 'Deterministic test plan',
        description: 'Prepare the controlled fixture change.',
        status: 'completed',
      }],
    }),
    researcher: async () => ({
      ...deterministicUpdate('researching'),
      research: 'Deterministic local test adapter.',
    }),
    architect: async (state: AegisState) => ({
      ...deterministicUpdate('architecting'),
      architecture: 'A single authorized fixture file change.',
      codeChanges: state.codeChanges && state.codeChanges.length > 0 ? state.codeChanges : [{
        path: changePath,
        action: changeAction,
        content: changeContent,
        summary: 'Deterministic cross-process validation change.',
      }],
    }),
    developer: async (state: AegisState) => ({
      ...deterministicUpdate('developing'),
      codeChanges: state.codeChanges,
    }),
    tester: async (state: AegisState) => {
      const command = process.env.AEGIS_TEST_COMMAND || 'npm test';
      const isApproved = Boolean(
        state.approvalDecision && state.approvalDecision.action === 'approve'
      );
      const approvalContext = isApproved && state.approvalDecision && state.workspace ? {
        runId: state.runId,
        approvalId: state.approvalDecision.approvalId,
        workspace: fs.realpathSync(path.resolve(state.workspace)).toLowerCase(),
        allowedActions: ['execute_terminal'],
        allowedTargets: [command],
      } : undefined;
      const startTime = Date.now();
      const result = await runCommand(command, {
        cwd: state.workspace,
        workspaceRoot: state.workspace,
        executionMode: 'automatic',
        runId: state.runId,
        timeoutMs: 120_000,
        isApproved,
        approvalContext,
        sandbox: process.env.AEGIS_REQUIRE_SANDBOX === '1'
          ? 'require'
          : (process.env.AEGIS_TEST_ADAPTER === '1' ? 'none' : 'auto'),
      });
      const durationMs = Date.now() - startTime;
      const isEnvFailure = isEnvironmentOrSetupFailure(result.stdout, result.stderr);
      const verificationRecord: VerificationRecord = {
        command,
        workspace: state.workspace,
        exitCode: result.exitCode ?? null,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs,
        timeoutMs: 120_000,
        approvalId: state.approvalDecision?.approvalId,
        status: !isApproved && result.exitCode === null
          ? 'blocked'
          : isEnvFailure
          ? 'environment_failure'
          : result.success
          ? 'passed'
          : 'failed',
        executedAt: Date.now(),
      };
      return {
        ...deterministicUpdate('testing'),
        testResults: {
          passed: result.success,
          totalTests: 1,
          passedTests: result.success ? 1 : 0,
          failedTests: result.success ? 0 : 1,
          output: `${result.stdout}${result.stderr}`.trim(),
          verificationRecord,
        },
        executionLog: [
          `[TEST-TOOL] Ran ${command}: ${result.success ? 'PASSED' : 'FAILED'} (exit ${result.exitCode ?? 'blocked'}, ${durationMs}ms)`,
        ],
      };
    },
    reviewer: async () => ({
      ...deterministicUpdate('completed'),
      reviewResults: { approved: true, comments: [] },
    }),
  });
}

export function createProposalTool(proposals: CodeChange[], workspace?: string) {
  return createAegisTool(async (input) => {
    let action = input.action;
    if (workspace) {
      const fullPath = path.resolve(workspace, input.path);
      const exists = fs.existsSync(fullPath);
      if (exists && action === 'add') {
        action = 'modify';
      } else if (!exists && action === 'modify') {
        action = 'add';
      }
    }
    const proposal: CodeChange = {
      path: input.path,
      action,
      content: input.content,
      summary: input.summary,
    };
    proposals.push(proposal);
    return JSON.stringify({ accepted: true, proposal });
  }, {
    name: 'propose_file_change',
    description: 'Record a proposed file change for human approval. This never writes to disk.',
    schema: z.object({
      path: z.string().min(1).max(260),
      action: z.enum(['add', 'modify', 'delete']),
      content: z.string().max(200_000).optional(),
      summary: z.string().max(500).optional(),
    }),
  });
}

export function getInvestigationModel(mode: 'investigate' | 'fix' = 'investigate'): AgentModel | undefined {
  if (process.env.AEGIS_TEST_ADAPTER !== '1') return undefined;
  let round = 0;
  return {
    model: 'deterministic-local-adapter',
    async generate(contents: Content[], _declarations: FunctionDeclaration[]) {
      round++;
      const userPrompt = contents.find((c) => c.role === 'user')?.parts?.[0]?.text || '';
      const isRepair = userPrompt.includes('Verification failed') || userPrompt.includes('repair revision');

      // Scenario B: Unknown Target Component (e.g. NonExistentComponent)
      if (userPrompt.includes('NonExistentComponent') || userPrompt.includes('nonexistent') || process.env.AEGIS_TEST_SCENARIO === 'unknown_target') {
        if (round === 1) {
          return {
            functionCalls: [
              { id: 'search-unknown', name: 'search_repository', args: { query: 'NonExistentComponent' } },
              { id: 'discover-unknown', name: 'discover_files', args: { pattern: 'NonExistentComponent' } },
            ],
          };
        }
        return {
          text: "Target component 'NonExistentComponent' was not found in the workspace. Verified 0 matching files and 0 matching symbols. Reporting limitation: cannot propose code modifications for an unknown component.",
        };
      }

      // Scenario D: Repeated Tool Strategy & Bounded Recovery
      if (process.env.AEGIS_TEST_SCENARIO === 'repeated_calls') {
        if (round === 1) {
          return {
            functionCalls: [
              { id: 'rep-1', name: 'discover_files', args: { pattern: 'auth' } },
            ],
          };
        }
        if (round === 2) {
          // Intentionally repeat identical call to trigger loop warning
          return {
            functionCalls: [
              { id: 'rep-2', name: 'discover_files', args: { pattern: 'auth' } },
            ],
          };
        }
        // Round 3: Observe loop guidance and conclude
        return {
          text: "Investigation adapted strategy after detecting repeated query. Verified repository files and concluded analysis with available evidence.",
        };
      }

      // Scenario E: Model Tool Call Failure Recovery (malformed call)
      if (process.env.AEGIS_TEST_SCENARIO === 'malformed_tool' && round === 1) {
        return {
          functionCalls: [
            { id: 'bad-1', name: 'unregistered_tool_xyz', args: {} },
            { id: 'bad-2', name: '', args: {} },
          ],
        };
      }
      if (round === 1) {
        const calls: any[] = [
          { id: 'search-1', name: 'search_repository', args: { query: process.env.AEGIS_TEST_SEARCH_QUERY || 'discount' } },
          { id: 'discover-1', name: 'discover_files', args: {} },
        ];
        if (process.env.AEGIS_TEST_INVOKE_SKILL === '1') {
          calls.push({ id: 'skill-1', name: 'load_skill', args: { name: process.env.AEGIS_TEST_SKILL_NAME || 'repository-investigation' } });
        }
        return {
          functionCalls: calls,
        };
      }

      if (round === 2) {
        let targetPath = process.env.AEGIS_TEST_READ_PATH;
        if (!targetPath) {
          for (const c of contents) {
            for (const p of c.parts || []) {
              if (p.functionResponse?.name === 'discover_files') {
                try {
                  const res = typeof p.functionResponse.response?.result === 'string'
                    ? JSON.parse(p.functionResponse.response.result)
                    : p.functionResponse.response?.result;
                  if (Array.isArray(res?.files)) {
                    const normFiles = res.files.map((f: string) => f.replace(/\\/g, '/'));
                    const candidate = normFiles.find((f: string) => f.startsWith('src/') && !f.includes('test') && !f.includes('currency'))
                      || normFiles.find((f: string) => f.startsWith('src/') && !f.includes('test'))
                      || normFiles[0];
                    if (candidate) targetPath = candidate;
                  }
                } catch {}
              }
            }
          }
        }
        return {
          functionCalls: [{
            id: 'read-1',
            name: 'read_source_file',
            args: { path: (targetPath || 'src/auth.ts').replace(/\\/g, '/') },
          }],
        };
      }
      if (mode === 'fix' && round === 3) {
        let observedContent: string | undefined;
        let observedPath: string | undefined;
        for (const c of contents) {
          for (const p of c.parts || []) {
            if (p.functionResponse?.name === 'read_source_file') {
              try {
                const res = typeof p.functionResponse.response?.result === 'string'
                  ? JSON.parse(p.functionResponse.response.result)
                  : p.functionResponse.response?.result;
                if (res?.content) {
                  observedContent = res.content;
                  observedPath = (res.path || '').replace(/\\/g, '/');
                }
              } catch {}
            }
          }
        }

        let patchContent: string | undefined;

        if (!isRepair) {
          patchContent = process.env.AEGIS_TEST_INITIAL_PATCH || process.env.AEGIS_TEST_CHANGE_CONTENT;
          if (!patchContent && observedContent) {
            const bugPattern = process.env.AEGIS_BUG_PATTERN;
            const fixReplacement = process.env.AEGIS_FIX_REPLACEMENT;
            if (bugPattern && fixReplacement && observedContent.includes(bugPattern)) {
              patchContent = observedContent.replace(bugPattern, fixReplacement);
            } else if (observedContent.includes('return price + discountAmount;')) {
              patchContent = observedContent.replace('return price + discountAmount;', 'return price - discountAmount;');
            }
          }
        } else {
          if (process.env.AEGIS_TEST_REVISION_FAIL_TWICE === '1' && userPrompt.includes('attempt 1')) {
            patchContent = process.env.AEGIS_TEST_INITIAL_PATCH || observedContent;
          } else {
            patchContent = process.env.AEGIS_TEST_REVISED_PATCH || process.env.AEGIS_TEST_CHANGE_CONTENT;
            if (!patchContent && observedContent) {
              const bugPattern = process.env.AEGIS_BUG_PATTERN;
              const fixReplacement = process.env.AEGIS_FIX_REPLACEMENT;
              if (bugPattern && fixReplacement && observedContent.includes(bugPattern)) {
                patchContent = observedContent.replace(bugPattern, fixReplacement);
              } else if (observedContent.includes('return price + discountAmount;')) {
                patchContent = observedContent.replace('return price + discountAmount;', 'return price - discountAmount;');
              } else if (observedContent.includes('return (price + discountAmount) / 2;')) {
                patchContent = observedContent.replace('return (price + discountAmount) / 2;', 'return price - discountAmount;');
              }
            }
          }
        }

        const chosenPath = (process.env.AEGIS_TEST_CHANGE_PATH || observedPath || 'src/aegis-test.txt').replace(/\\/g, '/');

        return {
          functionCalls: [{
            id: 'proposal-1',
            name: 'propose_file_change',
            args: {
              path: chosenPath,
              action: process.env.AEGIS_TEST_CHANGE_ACTION === 'modify' || observedPath ? 'modify' : 'add',
              content: patchContent || 'authorized-change\n',
              summary: isRepair ? 'Deterministic native repair revision.' : 'Deterministic native FIX proposal based on observed defect.',
            },
          }],
        };
      }
      const observations = contents
        .filter((content) => content.role === 'user')
        .flatMap((content) => content.parts ?? [])
        .map((part) => JSON.stringify(part))
        .join('\n');
      return {
        text: `Grounded investigation completed. Evidence was collected from the selected workspace.\n${observations.slice(0, 1200)}`,
      };
    },
  };
}

export function resolveTargetWorkspace(taskInput: string, defaultCwd: string): string {
  const normalizedTask = taskInput.toLowerCase();

  const pathMatch = taskInput.match(/(?:in|at|workspace|folder|dir|directory)\s+["']?([a-zA-Z]:\\[^"'\s]+|\/[^"'\s]+|\.[/\\][^"'\s]+)["']?/i);
  if (pathMatch && fs.existsSync(pathMatch[1])) {
    try {
      const stat = fs.statSync(pathMatch[1]);
      if (stat.isDirectory()) {
        return path.resolve(pathMatch[1]);
      }
    } catch {}
  }

  const searchBases = [
    defaultCwd,
    path.dirname(defaultCwd),
    path.dirname(path.dirname(defaultCwd)),
  ];

  const normTaskAlphaOnly = normalizedTask.replace(/[^a-z0-9]/g, '');

  for (const baseDir of searchBases) {
    if (!fs.existsSync(baseDir)) continue;
    try {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const folderName = entry.name;
        if (folderName === 'node_modules' || folderName.startsWith('.')) continue;

        const normFolder = folderName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normFolder.length < 3) continue;

        if (normTaskAlphaOnly.includes(normFolder)) {
          return path.join(baseDir, folderName);
        }

        if (
          (normalizedTask.includes('blog app') ||
            normalizedTask.includes('blog-app') ||
            normalizedTask.includes('blog_app') ||
            normalizedTask.includes('blog website') ||
            normalizedTask.includes('blog_website')) &&
          normFolder.includes('blog')
        ) {
          return path.join(baseDir, folderName);
        }
      }
    } catch {}
  }

  return defaultCwd;
}

// ── Shared Command Handlers ──────────────────────────────────────────────────

export async function handleConnect(rawUrl = '.', rawToken?: string) {
  const token = rawToken || process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || process.env.GH_TOKEN;
  const targetPath = rawUrl === '.' ? process.cwd() : rawUrl;
  console.log(`\n🔍 Validating access for repository: "${targetPath}"...`);
  if (token) {
    console.log(`🔑 Using GitHub token from .env for authentication.`);
  }

  const validation = await validateRepositoryAccess(targetPath, { token });
  if (!validation.valid || !validation.repository) {
    console.error(`\n❌ Connection Failed: ${validation.error}`);
    process.exitCode = 1;
    return;
  }

  let repoPath = targetPath;
  let cleanupRemote: (() => void) | undefined;

  const repoMeta = createRepositoryIdentity({
    provider: validation.repository.provider as any,
    owner: validation.repository.owner!,
    name: validation.repository.name!,
    url: validation.repository.url!,
    cleanUrl: validation.repository.url!,
  });

  if (validation.repository.provider === 'github') {
    console.log(`\n📥 Ingesting remote GitHub repository...`);
    const remoteRes = await ingestRemoteRepository({
      url: validation.repository.url!,
      owner: validation.repository.owner!,
      name: validation.repository.name!,
      branch: validation.repository.defaultBranch,
      token,
    });
    repoPath = remoteRes.localPath;
    cleanupRemote = remoteRes.cleanup;
    if (remoteRes.commitSha && remoteRes.commitSha !== 'HEAD') {
      repoMeta.commitSha = remoteRes.commitSha;
      repoMeta.analyzedRevision = remoteRes.commitSha;
    }
  }

  console.log(`\n⚡ Scanning files and extracting AST symbols...`);
  const files = await scanRepositoryDirectory(repoPath, { repoId: repoMeta.id, revision: repoMeta.analyzedRevision });
  const fileContents: Record<string, string> = {};
  for (const f of files) {
    try { fileContents[f.path] = fs.readFileSync(path.resolve(repoPath, f.path), 'utf-8'); } catch {}
  }

  const allPaths = files.map((f) => f.path);
  const symbols: SymbolRecord[] = [];
  const importsExports: ImportExportRecord[] = [];

  for (const f of files) {
    const content = fileContents[f.path] || '';
    if (['TypeScript', 'JavaScript', 'TSX', 'JSX'].includes(f.language)) {
      symbols.push(...parseTypeScriptSymbols({ repoId: repoMeta.id, fileId: f.id, filePath: f.path, content, language: f.language }));
      importsExports.push(...extractImportExports({ repoId: repoMeta.id, fileId: f.id, filePath: f.path, content, allFilePaths: allPaths }));
    }
  }

  const dependencies = extractDependencies({ repoId: repoMeta.id, files, fileContents });
  const apis = extractApiRoutes({ repoId: repoMeta.id, files, fileContents, symbols });
  const databases = extractDatabaseModels({ repoId: repoMeta.id, files, fileContents });
  const tests = extractTests({ repoId: repoMeta.id, files, fileContents, symbols });
  const { commits: gitCommits } = await analyzeGitHistory({ repoId: repoMeta.id, repoPath, maxCommits: 30 });

  const relationships = buildRelationshipGraph({
    repoId: repoMeta.id,
    files,
    symbols,
    importsExports,
    apis,
    databases,
    tests,
    fileContents,
  });

  repoMeta.status = 'ready';
  repoMeta.metadata = {
    analyzerVersion: 'Aegis Repository Intelligence v1',
    fileCount: files.length,
    sourceFileCount: files.filter((f) => f.category === 'SOURCE').length,
    symbolCount: symbols.length,
    relationshipCount: relationships.length,
    apiCount: apis.length,
    databaseModelCount: databases.length,
    testCount: tests.length,
    unsupportedLanguageCount: files.filter((f) => !['TypeScript', 'JavaScript', 'TSX', 'JSX'].includes(f.language)).length,
  };

  const snapshot: RepositorySnapshot = {
    repository: repoMeta,
    files,
    symbols,
    importsExports,
    dependencies,
    apis,
    databases,
    tests,
    gitCommits,
    relationships,
  };

  await store.saveSnapshot(snapshot);
  if (cleanupRemote) cleanupRemote();

  console.log(`\n================================================================`);
  console.log(` ✅ REPOSITORY CONNECTED & INDEXED SUCCESSFULLY!`);
  console.log(`================================================================`);
  console.log(`  Repository ID : ${repoMeta.id}`);
  console.log(`  Name          : ${repoMeta.owner}/${repoMeta.name}`);
  console.log(`  Provider      : ${repoMeta.provider}`);
  console.log(`  Files Found   : ${files.length}`);
  console.log(`  AST Symbols   : ${symbols.length}`);
  console.log(`  API Routes    : ${apis.length}`);
  console.log(`  DB Schemas    : ${databases.length}`);
  console.log(`  Graph Edges   : ${relationships.length}`);
  console.log(`================================================================\n`);
}

export async function handleStatus(repoId: string) {
  if (!repoId) {
    console.log('Error: Please specify repoId. Example: npx tsx cli.ts status repo_local_local_aegis');
    return;
  }
  const snapshot = await store.getSnapshot(repoId);
  if (!snapshot) {
    console.log(`Error: Snapshot for repoId="${repoId}" not found. Run "npx tsx cli.ts connect <url>" first.`);
    return;
  }
  console.log(`\n${getRepositoryStatus(snapshot)}\n`);
}

export async function handleSearch(repoId: string, queryStr: string, targetEntity?: string) {
  if (!repoId || !queryStr) {
    console.log('Error: Usage: npx tsx cli.ts search <repoId> "<query>" [targetEntity]');
    return;
  }
  const snapshot = await store.getSnapshot(repoId);
  if (!snapshot) {
    console.log(`Error: Snapshot for repoId="${repoId}" not found. Run "npx tsx cli.ts connect <url>" first.`);
    return;
  }
  const res = await queryRepositoryIntelligence({
    snapshot,
    query: queryStr,
    targetEntity,
  });
  console.log(`\n${res.formattedContext}\n`);
}

export async function handleImpact(repoId: string, targetEntity: string) {
  if (!repoId || !targetEntity) {
    console.log('Error: Usage: npx tsx cli.ts impact <repoId> <targetEntity>');
    return;
  }
  const snapshot = await store.getSnapshot(repoId);
  if (!snapshot) {
    console.log(`Error: Snapshot for repoId="${repoId}" not found. Run "npx tsx cli.ts connect <url>" first.`);
    return;
  }
  const res = await queryRepositoryIntelligence({
    snapshot,
    query: `If I change ${targetEntity}, what could be affected?`,
    targetEntity,
  });
  console.log(`\n${res.formattedContext}\n`);
}

export async function handleInvestigate(goal: string, workspace: string, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<string> {
  const runId = generateRunId();
  const resolvedWs = path.resolve(workspace);

  const initialState = {
    task: goal,
    workspace: resolvedWs,
    status: 'investigating' as const,
    executionKind: 'INVESTIGATE' as const,
    executionMode: 'automatic' as const,
    runId,
  };
  approvalRuntime.registerRun(runId, initialState as AegisState);
  const tools = createInvestigationTools(resolvedWs);
  const indexedSnapshot = await findMatchingRepoSnapshot(resolvedWs);
  if (indexedSnapshot) {
    tools.push(createRepositoryIntelligenceTool(indexedSnapshot.repository.id));
  }
  console.log(`\n🔎 Investigating "${goal}" in ${resolvedWs}`);
  const investigationModel = getInvestigationModel();
  approvalRuntime.attachNativeAgentRun(runId, {
    mode: 'INVESTIGATE',
    model: investigationModel?.model ?? process.env.GEMINI_MODEL ?? 'configured-model',
    goal,
    finalOutput: '',
    termination: 'running',
    toolCalls: [],
    evidence: [],
    verification: 'unverified',
  });

  const snapshot = indexedSnapshot ?? await findMatchingRepoSnapshot(resolvedWs);
  if (snapshot?.repository && snapshot.repository.commitSha && snapshot.repository.analyzedRevision) {
    const liveRevision = getWorkspaceRevision(resolvedWs);
    if (liveRevision && snapshot.repository.commitSha !== liveRevision) {
      console.log(`\n⚠️ Snapshot freshness warning: indexed revision ${snapshot.repository.commitSha} differs from live workspace HEAD ${liveRevision}.`);
    }
  }

  const groundedContext = assembleGroundedContext({
    workspace: resolvedWs,
    goal,
    executionKind: 'INVESTIGATE',
    snapshot,
  });
  console.log(`  Grounded Context: ${groundedContext.relevantFiles.length} files, ${groundedContext.relevantSymbols.length} symbols, ${groundedContext.availableSkills.length} skills (${groundedContext.freshnessStatus.toUpperCase()})`);

  let result;
  try {
    const investigatePrompt =
      `Investigate the following repository objective: ${goal}.\n` +
      `Read the relevant source files and tests, inspect the logic, and produce a thorough, grounded explanation citing exact source lines (e.g. path/file.ts:123).\n` +
      `If the requested component or file does not exist, clearly report that limitation with evidence. Conclude with a clear grounded explanation.`;

    result = await runToolAgent(investigatePrompt, tools, {}, {
      model: investigationModel,
      groundedContext,
      maxIterations: 8,
      maxToolCalls: 16,
      timeoutMs: options?.timeoutMs ?? 60_000,
      signal: options?.signal,
      onToolExecution: (record) => {
        console.log(`  [${record.policyDecision}] ${record.name} (${record.durationMs}ms)`);
        approvalRuntime.appendNativeAgentToolCall(runId, record);
      },
    });
  } catch (error) {
    const message = (error as Error).message;
    const failedRecord: NativeAgentRunRecord = {
      mode: 'INVESTIGATE',
      model: investigationModel?.model ?? process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
      goal,
      finalOutput: '',
      termination: message.includes('timed out')
        ? 'timeout'
        : message.includes('cancelled')
          ? 'cancelled'
          : 'model_error',
      toolCalls: [],
      evidence: [],
      verification: 'unverified',
    };
    approvalRuntime.attachNativeAgentRun(runId, failedRecord);
    throw error;
  }

  const evidenceCandidates: SourceEvidence[] = result.toolCallsExecuted.flatMap((call) => {
    try {
      const parsed = JSON.parse(call.output) as {
        matches?: Array<{ path: string; line: number; text?: string }>;
        path?: string; startLine?: number; endLine?: number; contentHash?: string;
      };
      if (parsed.matches) return parsed.matches.map((match) => ({
        path: match.path, line: match.line, reason: `Search match for ${call.name}`, observedText: match.text,
      }));
      return parsed.path ? [{
        path: parsed.path, line: parsed.startLine ?? 1, endLine: parsed.endLine,
        reason: `Read by ${call.name}`, contentHash: parsed.contentHash, observedText: undefined,
      }] : [];
    } catch {
      return [];
    }
  });

  const citedReferences: SourceEvidence[] = [];
  const referencePattern = /([A-Za-z0-9_.\\/-]+\.(?:ts|tsx|js|jsx|py)):(\d+)/g;
  for (const match of result.text.matchAll(referencePattern)) {
    citedReferences.push({
      path: match[1],
      line: Number(match[2]),
      reason: 'Model-cited reference',
    });
  }

  const validation = validateSourceEvidence(resolvedWs, [...evidenceCandidates, ...citedReferences]);
  const evidence = validation.valid;
  const verification = result.termination !== 'completed'
    ? 'unverified'
    : evidence.length === 0
      ? 'insufficient_evidence'
      : validation.invalid.length > 0 || validation.stale.length > 0
        ? 'partially_supported'
        : 'supported';

  const nativeRecord: NativeAgentRunRecord = {
    mode: 'INVESTIGATE',
    model: investigationModel?.model ?? process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
    goal,
    finalOutput: result.text,
    termination: result.termination,
    toolCalls: result.toolCallsExecuted,
    evidence,
    verification,
    evidenceValidation: {
      valid: validation.valid.length,
      invalid: validation.invalid.length,
      stale: validation.stale.length,
    },
    skillsOffered: result.skillsOffered,
    skillsLoaded: result.skillsLoaded,
    contextMetrics: {
      promptChars: result.promptChars,
      relevantFilesCount: groundedContext.relevantFiles.length,
      relevantSymbolsCount: groundedContext.relevantSymbols.length,
      freshnessStatus: groundedContext.freshnessStatus,
    },
  };
  approvalRuntime.attachNativeAgentRun(runId, nativeRecord);
  const finalState = {
    task: goal,
    workspace: resolvedWs,
    status: result.termination === 'completed' ? 'completed' : 'failed',
    executionKind: 'INVESTIGATE' as const,
    executionMode: 'automatic' as const,
    runId,
  } as unknown as AegisState;
  approvalRuntime.updateRunState(runId, finalState);

  console.log(`\nRun ID: ${runId}`);
  console.log(`Termination: ${result.termination}`);
  console.log(`\n${renderMarkdown(result.text)}`);
  console.log(`\nEvidence:`);
  evidence.forEach((item) => console.log(`  - ${item.path}${item.line ? `:${item.line}` : ''} — ${item.reason}`));

  return runId;
}

export async function handleFix(
  goal: string,
  workspace: string,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<{ runId: string; status: string; pendingApproval?: any; proposals: CodeChange[] }> {
  const runId = generateRunId();
  const resolvedWs = path.resolve(workspace);

  const proposals: CodeChange[] = [];
  const tools = [
    ...createInvestigationTools(resolvedWs),
    createProposalTool(proposals, resolvedWs),
  ];
  const model = getInvestigationModel('fix');

  approvalRuntime.registerRun(runId, {
    task: goal,
    workspace: resolvedWs,
    status: 'investigating',
    executionKind: 'FIX',
    executionMode: 'semi-auto',
    runId,
  } as AegisState);

  approvalRuntime.attachNativeAgentRun(runId, {
    mode: 'FIX',
    model: model?.model ?? process.env.GEMINI_MODEL ?? 'configured-model',
    goal,
    finalOutput: '',
    termination: 'running',
    toolCalls: [],
    evidence: [],
    verification: 'unverified',
  });

  const snapshot = await findMatchingRepoSnapshot(resolvedWs);
  if (snapshot?.repository?.id) {
    tools.push(createRepositoryIntelligenceTool(snapshot.repository.id));
  }
  const groundedContext = assembleGroundedContext({
    workspace: resolvedWs,
    goal,
    executionKind: 'FIX',
    snapshot,
    runId,
  });
  console.log(`  Grounded Context: ${groundedContext.relevantFiles.length} files, ${groundedContext.relevantSymbols.length} symbols, ${groundedContext.availableSkills.length} skills (${groundedContext.freshnessStatus.toUpperCase()})`);

  const fixPrompt =
    `Investigate this repository task and propose the smallest safe fix: ${goal}.\n` +
    `Read the relevant source and tests first.\n` +
    `If the requested target component or file does NOT exist in the repository, state that limitation clearly; do NOT invent files or propose arbitrary mutations.\n` +
    `Avoid unnecessary changes or rewrites to existing test files; fix the underlying source code so existing tests pass.\n` +
    `When proposing file changes:\n` +
    `- Use 'modify' for existing files (never use 'add' for a file that already exists on disk).\n` +
    `- Use 'add' ONLY for brand-new files that do not exist yet.\n` +
    `- Use 'delete' only for files that currently exist.\n` +
    `If a defect is confirmed, use propose_file_change for each exact file change.\n` +
    `Do not claim a change was applied; proposals require approval.`;

  let result;
  try {
    result = await runToolAgent(
      fixPrompt,
      tools,
      {},
      {
        model,
        groundedContext,
        maxIterations: 10,
        maxToolCalls: 24,
        timeoutMs: options?.timeoutMs ?? 60_000,
        signal: options?.signal,
        onToolExecution: (record) => {
          console.log(`  [${record.policyDecision}] ${record.name} (${record.durationMs}ms)`);
          approvalRuntime.appendNativeAgentToolCall(runId, record);
        },
      }
    );
  } catch (error) {
    const message = (error as Error).message;
    const failedRecord: NativeAgentRunRecord = {
      mode: 'FIX',
      model: model?.model ?? process.env.GEMINI_MODEL ?? 'configured-model',
      goal,
      finalOutput: '',
      termination: message.includes('timed out')
        ? 'timeout'
        : message.includes('cancelled')
          ? 'cancelled'
          : 'model_error',
      toolCalls: [],
      evidence: [],
      verification: 'unverified',
    };
    approvalRuntime.attachNativeAgentRun(runId, failedRecord);
    const failedState = {
      task: goal,
      workspace: resolvedWs,
      status: 'failed' as const,
      executionKind: 'FIX' as const,
      executionMode: 'semi-auto' as const,
      runId,
      errors: [message],
    } as unknown as AegisState;
    approvalRuntime.registerRun(runId, failedState);
    return { runId, status: 'failed', proposals: [] };
  }

  if (result.termination === 'provider_error' || result.termination === 'model_error' || result.termination === 'cancelled') {
    const failedRecord: NativeAgentRunRecord = {
      mode: 'FIX',
      model: model?.model ?? process.env.GEMINI_MODEL ?? 'configured-model',
      goal,
      finalOutput: result.text,
      termination: result.termination,
      toolCalls: result.toolCallsExecuted,
      evidence: [],
      verification: 'unverified',
    };
    approvalRuntime.attachNativeAgentRun(runId, failedRecord);
    const failedState = {
      task: goal,
      workspace: resolvedWs,
      status: (result.termination === 'cancelled' ? 'cancelled' : 'failed') as any,
      executionKind: 'FIX' as const,
      executionMode: 'semi-auto' as const,
      runId,
      errors: [result.error || result.text],
    } as unknown as AegisState;
    approvalRuntime.registerRun(runId, failedState);
    return { runId, status: failedState.status, proposals: [] };
  }

  if (proposals.length === 0) {
    const state = {
      task: goal,
      workspace: resolvedWs,
      status: 'failed' as const,
      executionKind: 'FIX' as const,
      executionMode: 'semi-auto' as const,
      runId,
      errors: ['Native FIX completed without a file proposal.'],
    };
    approvalRuntime.registerRun(runId, state as AegisState);
    approvalRuntime.attachNativeAgentRun(runId, {
      mode: 'FIX',
      model: model?.model ?? process.env.GEMINI_MODEL ?? 'configured-model',
      goal,
      finalOutput: result.text,
      termination: result.termination,
      toolCalls: result.toolCallsExecuted,
      evidence: [],
      verification: 'insufficient_evidence',
    });
    console.error(`No file proposal was produced. Run ID: ${runId}`);
    if (!process.env.AEGIS_TEST_ADAPTER && !process.env.AEGIS_INTERACTIVE) { process.exitCode = 1; }
    return { runId, status: 'failed', proposals: [] };
  }

  const initialState = {
    task: goal,
    workspace: resolvedWs,
    status: 'idle' as const,
    executionKind: 'FIX' as const,
    executionMode: 'semi-auto' as const,
    runId,
    codeChanges: proposals,
    maxRetries: 2,
  };

  await executeApprovalWorkflow(runId, initialState, getCliWorkflow());
  const runToUpdate = approvalRuntime.getRun(runId);
  if (runToUpdate && runToUpdate.pendingApproval) {
    runToUpdate.attempts = [{
      attemptNumber: 0,
      approvalId: runToUpdate.pendingApproval.id,
      codeChanges: proposals,
      status: 'proposed',
      timestamp: Date.now(),
    }];
    approvalRuntime.persistRunToDisk(runToUpdate);
  }

  approvalRuntime.attachNativeAgentRun(runId, {
    mode: 'FIX',
    model: model?.model ?? process.env.GEMINI_MODEL ?? 'configured-model',
    goal,
    finalOutput: result.text,
    termination: result.termination,
    toolCalls: result.toolCallsExecuted,
    evidence: proposals.map((proposal) => ({
      path: proposal.path,
      reason: 'Native agent proposal; not yet applied.',
    })),
    verification: 'unverified',
    skillsOffered: result.skillsOffered,
    skillsLoaded: result.skillsLoaded,
    contextMetrics: {
      promptChars: result.promptChars,
      relevantFilesCount: groundedContext.relevantFiles.length,
      relevantSymbolsCount: groundedContext.relevantSymbols.length,
      freshnessStatus: groundedContext.freshnessStatus,
    },
  });

  const run = approvalRuntime.getPersistedRun(runId);
  console.log(`\nRun ID: ${runId}`);
  console.log(`Proposed changes: ${proposals.length}`);
  console.log(`\n${renderPatchPreview(resolvedWs, proposals)}`);
  if (run?.pendingApproval) {
    console.log(`Approval ID: ${run.pendingApproval.id}`);
    console.log(`Approve with: npx tsx cli.ts approve ${runId} ${run.pendingApproval.id} approve`);
  }

  return {
    runId,
    status: run?.state.status || 'paused',
    pendingApproval: run?.pendingApproval,
    proposals,
  };
}

export function handlePreview(runId: string): void {
  if (!runId) {
    console.log('Error: Usage: npx tsx cli.ts preview <runId>');
    return;
  }
  const run = approvalRuntime.getPersistedRun(runId);
  if (!run) {
    console.error(`Run not found: "${runId}"`);
    process.exitCode = 1;
    return;
  }
  if (!run.state.codeChanges || run.state.codeChanges.length === 0) {
    console.log(`Run "${runId}" has no proposed code changes.`);
    return;
  }
  console.log(renderPatchPreview(run.state.workspace, run.state.codeChanges));
}

export async function handleApprove(
  runId: string,
  approvalIdArg?: string,
  decisionArg = 'approve',
  interactivePrompt = false
): Promise<{ runId: string; status: string; pendingApproval?: any }> {
  if (!runId) {
    console.log('Error: Usage: npx tsx cli.ts approve <runId> [approvalId] [approve|reject]');
    return { runId: '', status: 'error' };
  }

  const run = approvalRuntime.getPersistedRun(runId);
  if (!run) {
    console.error(`Run not found: "${runId}"`);
    process.exitCode = 1;
    return { runId, status: 'not_found' };
  }

  let finalApprovalId = approvalIdArg;
  let finalDecision = decisionArg;

  if (!finalApprovalId || finalApprovalId === 'approve' || finalApprovalId === 'reject') {
    if (finalApprovalId === 'approve' || finalApprovalId === 'reject') {
      finalDecision = finalApprovalId;
    }
    if (!run.pendingApproval) {
      console.error(`Run "${runId}" does not have any pending approvals.`);
      process.exitCode = 1;
      return { runId, status: 'no_pending_approval' };
    }
    finalApprovalId = run.pendingApproval.id;

    console.log('\n' + renderPatchPreview(run.state.workspace, run.state.codeChanges || []));

    if ((!approvalIdArg || interactivePrompt) && process.stdin.isTTY) {
      const ans = await promptUser(`\nDo you want to [a]pprove or [r]eject this mutation? (a/r): `);
      finalDecision = ans.toLowerCase().startsWith('r') ? 'reject' : 'approve';
    }
  }

  if (finalDecision !== 'approve' && finalDecision !== 'reject') {
    console.error(`Invalid approval decision "${finalDecision}". Use "approve" or "reject".`);
    process.exitCode = 1;
    return { runId, status: 'invalid_decision' };
  }

  console.log(`\n🔄 Resuming Aegis Workflow for Run "${runId}" with decision "${finalDecision}"...`);
  const finalState = await resolveApprovalAndResume(
    runId,
    finalApprovalId,
    finalDecision as 'approve' | 'reject',
    undefined,
    getCliWorkflow()
  );

  if (finalState.testResults?.verificationRecord) {
    console.log('\n' + renderVerificationReport(finalState.testResults.verificationRecord, finalState.attempts));
  }

  if (finalState.status === 'paused' && finalState.pendingApproval) {
    console.log(`\n================================================================`);
    console.log(` ⏸️  VERIFICATION FAILED — REPAIR REVISION AWAITING APPROVAL`);
    console.log(`================================================================`);
    console.log(`  Run ID      : ${runId}`);
    console.log(`  Revision    : ${finalState.retryCount} of ${finalState.maxRetries || 2}`);
    console.log(`  Approval ID : ${finalState.pendingApproval.id}`);
    console.log(`  Action      : ${finalState.pendingApproval.action}`);
    console.log(`  Target      : ${finalState.pendingApproval.target}`);
    console.log(`  Reason      : ${finalState.pendingApproval.description}`);
    console.log(`================================================================`);
    if (finalState.codeChanges && finalState.codeChanges.length > 0) {
      console.log('\n' + renderPatchPreview(finalState.workspace, finalState.codeChanges));
    }
    console.log(`💡 To approve and execute revision, run:`);
    console.log(`   npx tsx cli.ts approve ${runId} ${finalState.pendingApproval.id} approve\n`);
    return { runId, status: finalState.status, pendingApproval: finalState.pendingApproval };
  }

  console.log(`\n================================================================`);
  if (finalDecision === 'reject') {
    console.log(` ⛔ WORKFLOW REJECTED — NO PROPOSAL APPLIED`);
  } else if (finalState.status === 'completed') {
    console.log(` ✅ WORKFLOW RESUMED AND EXECUTED! — VERIFICATION PASSED`);
  } else if (finalState.testResults?.verificationRecord?.status === 'environment_failure') {
    console.log(` ⚠️  ENVIRONMENT BLOCKED — SANDBOX UNAVAILABLE`);
  } else if (finalState.testResults?.verificationRecord?.status === 'failed') {
    console.log(` ❌ VERIFICATION FAILED — TEST SUITE FAILED`);
  } else if (finalState.status === 'failed') {
    console.log(` ❌ WORKFLOW MUTATION / EXECUTION FAILED`);
  } else {
    console.log(` ℹ️  WORKFLOW RESUMED (Status: ${finalState.status})`);
  }
  console.log(`================================================================`);
  console.log(`  Status       : ${finalState.status}`);
  console.log(`  Execution Log:`);
  finalState.executionLog?.forEach((l) => console.log(`    - ${l}`));
  console.log(`================================================================\n`);

  return { runId, status: finalState.status };
}

export function handleRunStatus(runId: string, options: { json?: boolean } = {}): void {
  if (!runId) {
    console.log('Error: Usage: npx tsx cli.ts run-status <runId> [--json]');
    return;
  }

  const run = approvalRuntime.getPersistedRun(runId);
  if (!run) {
    console.error(`Run not found: "${runId}"`);
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({
      version: run.version,
      runId: run.runId,
      status: run.state.status,
      task: run.state.task,
      workspace: run.state.workspace,
      pendingApproval: run.pendingApproval,
      approvalDecision: run.state.approvalDecision,
      codeChanges: run.state.codeChanges,
      testResults: run.state.testResults,
      reviewResults: run.state.reviewResults,
      changeEvidence: run.state.changeEvidence,
      executionLog: run.state.executionLog,
      errors: run.state.errors,
      events: run.events,
      nativeAgent: (run as typeof run & { nativeAgent?: NativeAgentRunRecord }).nativeAgent,
      attempts: run.attempts,
      verificationHistory: run.verificationHistory,
    }, null, 2));
    return;
  }

  console.log(renderRunStatusReport(run));
}

export function listPersistedRuns(limit = 10): Array<{ runId: string; task: string; status: string; workspace: string }> {
  const runs = approvalRuntime.listPersistedRuns(limit);
  return runs.map((r) => ({
    runId: r.runId,
    task: r.state?.task || 'No task recorded',
    status: r.state?.status || 'unknown',
    workspace: r.state?.workspace || '',
  }));
}
