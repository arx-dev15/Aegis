import './env.js';
/**
 * apps/cli/index.ts
 * 
 * Aegis CLI Application Module & Command Dispatcher.
 */

import fs from 'fs';
import path from 'path';
import {
  handleConnect,
  handleStatus,
  handleSearch,
  handleImpact,
  handleInvestigate,
  handleFix,
  handlePreview,
  handleApprove,
  handleRunStatus,
  listPersistedRuns,
  executeNativeRepair,
  resolveTargetWorkspace,
  getCliWorkflow,
} from './cliHandlers.js';
import { runConversationalSession, detectIntent } from './cliSession.js';
import {
  renderPatchPreview,
  renderVerificationReport,
  renderRunStatusReport,
  formatUnifiedDiff,
  stripAnsi,
  promptUser,
  closePrompt,
  renderActionMenu,
} from './cliPresentation.js';
import { executeApprovalWorkflow } from '../../src/runtime/approvalWorkflow.js';

export {
  // Handlers
  handleConnect,
  handleStatus,
  handleSearch,
  handleImpact,
  handleInvestigate,
  handleFix,
  handlePreview,
  handleApprove,
  handleRunStatus,
  listPersistedRuns,
  executeNativeRepair,
  resolveTargetWorkspace,
  getCliWorkflow,
  // Session
  runConversationalSession,
  detectIntent,
  // Presentation
  renderPatchPreview,
  renderVerificationReport,
  renderRunStatusReport,
  formatUnifiedDiff,
  stripAnsi,
  promptUser,
  closePrompt,
  renderActionMenu,
};

export async function mainWithArgs(args: string[]): Promise<void> {
  const command = args[0];

  // Conversation-first default launch routing: no-argument or direct interactive invocation
  if (!command || command === 'interactive' || command === '--workspace' || command === '--menu') {
    const wsFlagIdx = args.indexOf('--workspace');
    const workspace = wsFlagIdx >= 0 && args[wsFlagIdx + 1] ? args[wsFlagIdx + 1] : undefined;
    await runConversationalSession(workspace, { menuMode: args.includes('--menu') });
    return;
  }

  if (['--help', '-h', 'help'].includes(command)) {
    console.log(`
================================================================
  AEGIS REPOSITORY INTELLIGENCE — DEVELOPER CLI
================================================================

COMMANDS:

  1. Conversational Interactive Terminal (Default):
     npx tsx cli.ts [interactive] [--workspace <path>] [--menu]

  2. Connect & Ingest a Local or Remote GitHub Repository:
     npx tsx cli.ts connect <url_or_path> [github_token]

  3. Check Repository Intelligence Status & Statistics:
     npx tsx cli.ts status <repoId>

  4. Query Codebase Intelligence:
     npx tsx cli.ts search <repoId> "<query>" [targetEntity]

  5. Perform Impact Analysis:
     npx tsx cli.ts impact <repoId> <targetEntity>

  6. Inspect a Persisted Engineering Run:
     npx tsx cli.ts run-status <runId> [--json]

  7. Run a Bounded Read-Only Native Investigation:
     npx tsx cli.ts investigate "<question>" --workspace <path>

  8. Propose an Approved Native Repository Fix:
     npx tsx cli.ts fix "<task>" --workspace <path>

  9. Preview Proposed Patch Unified Diff:
     npx tsx cli.ts preview <runId>

  10. Approve or Reject a Proposed Mutation:
      npx tsx cli.ts approve <runId> [approvalId] [approve|reject]

================================================================
    `);
    return;
  }

  if (command === 'connect') {
    await handleConnect(args[1], args[2]);
    return;
  }

  if (command === 'status') {
    await handleStatus(args[1]);
    return;
  }

  if (command === 'search') {
    await handleSearch(args[1], args[2], args[3]);
    return;
  }

  if (command === 'impact') {
    await handleImpact(args[1], args[2]);
    return;
  }

  if (command === 'investigate') {
    const wsFlagIdx = args.indexOf('--workspace');
    let workspace: string;
    let goal: string;
    if (wsFlagIdx >= 0 && args[wsFlagIdx + 1]) {
      workspace = path.resolve(args[wsFlagIdx + 1]);
      const promptArgs = args.slice(1).filter((_arg, index) => index !== wsFlagIdx - 1 && index !== wsFlagIdx);
      goal = promptArgs.join(' ').trim();
    } else if (args.length >= 3 && fs.existsSync(args[args.length - 1])) {
      workspace = path.resolve(args[args.length - 1]);
      goal = args.slice(1, -1).join(' ').trim();
    } else {
      workspace = path.resolve(process.cwd());
      goal = args.slice(1).join(' ').trim();
    }
    if (!goal) {
      console.error('Error: Usage: npx tsx cli.ts investigate "<question>" [--workspace <path>]');
      process.exitCode = 1;
      return;
    }
    await handleInvestigate(goal, workspace);
    return;
  }

  if (command === 'fix') {
    const wsFlagIdx = args.indexOf('--workspace');
    let workspace: string;
    let goal: string;
    if (wsFlagIdx >= 0 && args[wsFlagIdx + 1]) {
      workspace = path.resolve(args[wsFlagIdx + 1]);
      const promptArgs = args.slice(1).filter((_arg, index) => index !== wsFlagIdx - 1 && index !== wsFlagIdx);
      goal = promptArgs.join(' ').trim();
    } else if (args.length >= 3 && fs.existsSync(args[args.length - 1])) {
      workspace = path.resolve(args[args.length - 1]);
      goal = args.slice(1, -1).join(' ').trim();
    } else {
      workspace = path.resolve(process.cwd());
      goal = args.slice(1).join(' ').trim();
    }
    if (!goal) {
      console.error('Error: Usage: npx tsx cli.ts fix "<task>" [--workspace <path>]');
      process.exitCode = 1;
      return;
    }
    await handleFix(goal, workspace);
    return;
  }

  if (command === 'run') {
    const runArgs = args.slice(1);
    const wsFlagIdx = runArgs.indexOf('--workspace');
    let workspaceOverride: string | undefined;
    let filteredTaskArgs = runArgs;

    if (wsFlagIdx !== -1 && runArgs[wsFlagIdx + 1]) {
      workspaceOverride = runArgs[wsFlagIdx + 1];
      filteredTaskArgs = runArgs.slice(0, wsFlagIdx).concat(runArgs.slice(wsFlagIdx + 2));
    }

    let executionMode: 'automatic' | 'semi-auto' | 'manual' = 'semi-auto';
    const modeFlagIdx = filteredTaskArgs.findIndex((a) => a === '--mode' || a === '--execution-mode');
    if (modeFlagIdx !== -1 && filteredTaskArgs[modeFlagIdx + 1]) {
      const parsedMode = filteredTaskArgs[modeFlagIdx + 1].toLowerCase();
      if (parsedMode === 'automatic' || parsedMode === 'semi-auto' || parsedMode === 'manual') {
        executionMode = parsedMode;
      }
      filteredTaskArgs = filteredTaskArgs.slice(0, modeFlagIdx).concat(filteredTaskArgs.slice(modeFlagIdx + 2));
    }

    const taskInput = filteredTaskArgs.join(' ');
    if (!taskInput) {
      console.log('Error: Usage: npx tsx cli.ts run "<task_description>" [--workspace <path>] [--mode <automatic|semi-auto|manual>]');
      return;
    }

    const runId = `run_${Date.now()}`;
    const defaultCwd = process.cwd();
    const workspace = workspaceOverride
      ? path.resolve(workspaceOverride)
      : resolveTargetWorkspace(taskInput, defaultCwd);

    console.log(`\n🚀 Starting Aegis Engineering Task Workflow...`);
    console.log(`  Task      : "${taskInput}"`);
    console.log(`  Workspace : ${workspace}`);
    console.log(`  Mode      : ${executionMode}`);
    console.log(`  Run ID    : ${runId}\n`);

    const initialState = {
      task: taskInput,
      workspace: workspace,
      executionMode: executionMode,
    };

    const finalState = await executeApprovalWorkflow(runId, initialState, getCliWorkflow());

    if (finalState.status === 'paused' && finalState.pendingApproval) {
      console.log(`\n================================================================`);
      console.log(` ⏸️  WORKFLOW PAUSED — HUMAN APPROVAL REQUIRED`);
      console.log(`================================================================`);
      console.log(`  Run ID      : ${runId}`);
      console.log(`  Approval ID : ${finalState.pendingApproval.id}`);
      console.log(`  Action      : ${finalState.pendingApproval.action}`);
      console.log(`  Target      : ${finalState.pendingApproval.target}`);
      console.log(`  Reason      : ${finalState.pendingApproval.description}`);
      console.log(`================================================================`);
      console.log(`💡 To approve and execute, run:`);
      console.log(`   npx tsx cli.ts approve ${runId} ${finalState.pendingApproval.id} approve\n`);
      return;
    }

    console.log(`\n================================================================`);
    console.log(` ✅ WORKFLOW COMPLETED SUCCESSFULLY!`);
    console.log(`================================================================`);
    console.log(`  Status       : ${finalState.status}`);
    console.log(`  Code Changes : ${finalState.codeChanges?.length || 0} file(s)`);
    if (finalState.testResults) {
      console.log(`  Test Status  : ${finalState.testResults.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
      console.log(`  Test Summary : ${finalState.testResults.output}`);
    }
    if (finalState.executionLog?.length) {
      console.log(`  Execution Log:`);
      finalState.executionLog.forEach((l) => console.log(`    - ${l}`));
    }
    console.log(`================================================================\n`);
    return;
  }

  if (command === 'preview' || command === 'diff') {
    handlePreview(args[1]);
    return;
  }

  if (command === 'approve') {
    await handleApprove(args[1], args[2], args[3] || 'approve');
    return;
  }

  if (command === 'run-status' || command === 'run-show') {
    handleRunStatus(args[1], { json: args.includes('--json') });
    return;
  }

  if (command === 'interactive') {
    const wsFlagIdx = args.indexOf('--workspace');
    const workspace = wsFlagIdx >= 0 && args[wsFlagIdx + 1] ? args[wsFlagIdx + 1] : process.cwd();
    await runConversationalSession(workspace, { menuMode: args.includes('--menu') });
    return;
  }

  console.log(`Unknown command "${command}". Run "npx tsx cli.ts --help" for options.`);
}
