import { gemini } from '../../src/agent/models/gemini/model.js';
import { approvalRuntime } from '../../src/runtime/approvalWorkflow.js';
import path from 'path';
import fs from 'fs';
import {
  promptUser,
  closePrompt,
  renderHelp,
  renderConsoleBanner,
  renderActionMenu,
  renderApprovalBox,
  renderPatchPreview,
  renderMarkdown,
  theme,
  style,
} from './cliPresentation.js';
import {
  handleInvestigate,
  handleFix,
  handlePreview,
  handleApprove,
  handleRunStatus,
  listPersistedRuns,
} from './cliHandlers.js';

export { renderConsoleBanner, renderActionMenu };

export type TaskIntent = 'conversation' | 'fix' | 'investigate' | 'ambiguous';

export function detectIntent(input: string): TaskIntent {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  if (!lower) return 'ambiguous';

  // 1. Conversational greetings and polite expressions
  const greetings = ['hey', 'hello', 'hi', 'howdy', 'yo', 'sup', 'greetings', 'good morning', 'good afternoon', 'good evening'];
  if (greetings.includes(lower) || greetings.some(g => lower.startsWith(g + ' ') || lower.startsWith(g + '!') || lower.startsWith(g + ','))) {
    return 'conversation';
  }

  const metaQueries = [
    'who are you', 'what are you', 'what can you do', 'what is aegis', 'how do i use aegis', 'tell me about aegis'
  ];
  if (metaQueries.includes(lower) || metaQueries.some(q => lower.startsWith(q))) {
    return 'conversation';
  }

  const politeQueries = ['thanks', 'thank you', 'ok', 'okay', 'cool', 'great', 'awesome'];
  if (politeQueries.includes(lower)) {
    return 'conversation';
  }

  // 2. Code-modifying / fix requests
  const fixPrefixes = ['fix', 'repair', 'patch', 'correct', 'refactor', 'update', 'modify', 'add', 'implement', 'remove', 'delete'];
  const isFixPrefix = fixPrefixes.some((p) => lower.startsWith(p + ' ') || lower === p);
  const hasFixPhrase = /\b(fix|repair|patch|correct|resolve)\s+(the|a|this|that|an)\b/i.test(lower);

  // 3. Read-only / investigation requests
  const invPrefixes = ['investigate', 'why', 'how', 'where', 'find', 'search', 'trace', 'explain', 'check', 'inspect', 'analyze', 'audit', 'show', 'query'];
  const isInvPrefix = invPrefixes.some((p) => lower.startsWith(p + ' ') || lower === p);
  const hasInvPhrase = /\b(why does|how does|where is|investigate the|check if|check whether|explain what|explain how|what does)\b/i.test(lower);

  if ((isFixPrefix || hasFixPhrase) && !isInvPrefix && !hasInvPhrase) {
    return 'fix';
  }
  if ((isInvPrefix || hasInvPhrase) && !isFixPrefix && !hasFixPhrase) {
    return 'investigate';
  }

  return 'ambiguous';
}

export async function runConversationalSession(
  initialWorkspace?: string,
  options: { menuMode?: boolean } = {}
): Promise<void> {
  let currentWorkspace = path.resolve(initialWorkspace || process.cwd());
  let lastRunId: string | undefined;
  let menuActive = Boolean(options.menuMode);

  console.log('\n' + renderConsoleBanner(currentWorkspace, undefined, options));

  let activeSession = true;
  const sigintHandler = () => {
    console.log('\n' + theme.amber('Session interrupted. Goodbye!'));
    closePrompt();
    process.exit(0);
  };
  process.on('SIGINT', sigintHandler);

  while (true) {
    const wsName = path.basename(currentWorkspace);
    const runTag = lastRunId ? theme.amber(`(run: ${lastRunId.slice(-8)})`) : theme.sage('(ready)');
    const promptStr = `${theme.gold('◆')} ${theme.bold(theme.ivory('aegis'))} ${theme.slate(`[${wsName}]`)} ${runTag} ${theme.gold('❯')} `;

    const rawInput = await promptUser(promptStr);
    const input = rawInput.trim();

    if (!input) {
      if (!process.stdin.isTTY) {
        closePrompt();
        break;
      }
      continue;
    }

    // ── Standard Exit Commands ──
    if (
      input === '6' ||
      input.toLowerCase() === 'exit' ||
      input.toLowerCase() === 'quit' ||
      input.toLowerCase() === '/exit' ||
      input.toLowerCase() === '/quit' ||
      input.toLowerCase() === ':q'
    ) {
      console.log(theme.ivory(theme.bold('Goodbye!')));
      closePrompt();
      break;
    }

    // ── Quick Numeric Menu Dispatch (ONLY when an explicit menu is active) ──
    if (menuActive) {
      if (input === '6') {
        menuActive = Boolean(options.menuMode);
        console.log(theme.ivory(theme.bold('Goodbye!')));
        closePrompt();
        break;
      }
      if (input === '1') {
        menuActive = Boolean(options.menuMode);
        const q = await promptUser(theme.gold('? ') + theme.ivory('Enter investigation question: '));
        if (q) {
          lastRunId = await handleInvestigate(q, currentWorkspace);
        }
        continue;
      }
      if (input === '2') {
        menuActive = Boolean(options.menuMode);
        const t = await promptUser(theme.gold('? ') + theme.ivory('Enter bug fix description: '));
        if (t) {
          const res = await handleFix(t, currentWorkspace);
          lastRunId = res.runId;
          if (res.status === 'paused' && res.pendingApproval) {
            await promptForApprovalDecision(res.runId, res.pendingApproval, currentWorkspace, res.proposals);
          }
        }
        continue;
      }
      if (input === '3') {
        menuActive = Boolean(options.menuMode);
        const rId = await promptUser(theme.gold('? ') + theme.ivory('Enter Run ID to preview: '));
        if (rId) handlePreview(rId);
        continue;
      }
      if (input === '4') {
        menuActive = Boolean(options.menuMode);
        const rId = await promptUser(theme.gold('? ') + theme.ivory('Enter Run ID to approve/reject: '));
        if (rId) {
          const res = await handleApprove(rId, undefined, 'approve', true);
          lastRunId = res.runId;
        }
        continue;
      }
      if (input === '5') {
        menuActive = Boolean(options.menuMode);
        const rId = await promptUser(theme.gold('? ') + theme.ivory('Enter Run ID to inspect: '));
        if (rId) handleRunStatus(rId);
        continue;
      }
    } else {
      // Lone numeric/c input when no menu is active
      if (/^[1-6]$/.test(input) || input.toLowerCase() === 'c') {
        console.log(theme.slate('No menu is currently active. Type your engineering task directly (e.g. "Fix discount bug", "Investigate API error") or use /menu to view numeric actions.'));
        continue;
      }
    }

    // ── Slash Commands ──

    const lower = input.toLowerCase();

    if (lower === '/help' || lower === 'help' || lower === '?') {
      console.log('\n' + renderHelp());
      continue;
    }

    if (lower === '/clear' || lower === 'clear' || lower === 'cls') {
      if (process.stdout.isTTY) {
        process.stdout.write('\x1b[2J\x1b[0;0H');
      }
      console.log('\n' + renderConsoleBanner(currentWorkspace, undefined, { menuMode: false }));
      continue;
    }

    if (lower === '/menu') {
      menuActive = true;
      console.log('\n' + renderActionMenu() + '\n');
      continue;
    }

    if (lower.startsWith('/workspace')) {
      const parts = input.split(/\s+/);
      if (parts.length > 1) {
        const target = path.resolve(parts.slice(1).join(' '));
        if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
          currentWorkspace = target;
          lastRunId = undefined;
          console.log(`Active workspace updated to: ${theme.bold(theme.ivory(currentWorkspace))}`);
        } else {
          console.log(theme.coral(`Directory does not exist: "${target}"`));
        }
      } else {
        console.log(`Current active workspace: ${theme.bold(theme.ivory(currentWorkspace))}`);
      }
      continue;
    }

    if (lower === '/runs') {
      const runs = listPersistedRuns(8);
      if (runs.length === 0) {
        console.log(theme.slate('No persisted runs found.'));
      } else {
        console.log(theme.bold(theme.gold('\nRECENT PERSISTED RUNS:')));
        for (const r of runs) {
          const statusBadge =
            r.status === 'completed'
              ? theme.badgeSage(r.status)
              : r.status === 'failed'
              ? theme.badgeCoral(r.status)
              : theme.badgeAmber(r.status);
          console.log(`  - ${theme.teal(r.runId)} ${statusBadge} ${theme.ivory(r.task)}`);
        }
        console.log('');
      }
      continue;
    }

    if (lower.startsWith('/status')) {
      const parts = input.split(/\s+/);
      const targetRunId = parts[1] || lastRunId;
      if (!targetRunId) {
        console.log(theme.amber('No run ID specified and no active run in current session.'));
      } else {
        handleRunStatus(targetRunId);
      }
      continue;
    }

    if (lower.startsWith('/diff') || lower.startsWith('/preview')) {
      const parts = input.split(/\s+/);
      const targetRunId = parts[1] || lastRunId;
      if (!targetRunId) {
        console.log(theme.amber('No run ID specified and no active run in current session.'));
      } else {
        handlePreview(targetRunId);
      }
      continue;
    }

    if (lower.startsWith('/approve')) {
      const parts = input.split(/\s+/);
      const targetRunId = parts[1] || lastRunId;
      const decisionArg = parts[2] || 'approve';
      if (!targetRunId) {
        console.log(theme.amber('No run ID specified to approve.'));
      } else {
        const res = await handleApprove(targetRunId, undefined, decisionArg, true);
        lastRunId = res.runId;
      }
      continue;
    }

    if (lower.startsWith('/reject')) {
      const parts = input.split(/\s+/);
      const targetRunId = parts[1] || lastRunId;
      if (!targetRunId) {
        console.log(theme.amber('No run ID specified to reject.'));
      } else {
        const res = await handleApprove(targetRunId, undefined, 'reject');
        lastRunId = res.runId;
      }
      continue;
    }

    if (lower.startsWith('/investigate ')) {
      const query = input.slice('/investigate '.length).trim();
      if (query) {
        try {
          const runId = await handleInvestigate(query, currentWorkspace);
          lastRunId = runId;
        } catch (err) {
          console.error(theme.coral(`Investigation error: ${(err as Error).message}`));
        }
      }
      continue;
    }

    if (lower.startsWith('/fix ')) {
      const task = input.slice('/fix '.length).trim();
      if (task) {
        try {
          const res = await handleFix(task, currentWorkspace);
          lastRunId = res.runId;
          if (res.status === 'paused' && res.pendingApproval) {
            await promptForApprovalDecision(res.runId, res.pendingApproval, currentWorkspace, res.proposals);
          }
        } catch (err) {
          console.error(theme.coral(`Fix execution error: ${(err as Error).message}`));
        }
      }
      continue;
    }

    // Reset menuActive when a natural language command is provided
    menuActive = Boolean(options.menuMode);

    // ── Natural Language Task Dispatch ──

    let intent = detectIntent(input);

    if (intent === 'conversation') {
      const greetings = ['hey', 'hello', 'hi', 'howdy', 'yo', 'sup', 'greetings', 'good morning', 'good afternoon', 'good evening'];
      const isGreeting = greetings.some(g => lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + '!') || lower.startsWith(g + ','));

      if (isGreeting) {
        console.log('\n' + theme.ivory("Hello! I am AEGIS, your autonomous software engineering harness. I'm ready to investigate code, explain architecture, or propose verified fixes in this workspace. What would you like to work on?"));
      } else if (lower.includes('who are you') || lower.includes('what can you do') || lower.includes('what is aegis')) {
        console.log('\n' + theme.ivory("I am AEGIS, a TypeScript-first autonomous software engineering harness with verified Docker execution, repository intelligence, and human authorization controls. You can ask me to investigate code issues, analyze dependencies, or propose and verify bug fixes."));
      } else if (['thanks', 'thank you', 'ok', 'okay', 'cool', 'great', 'awesome'].includes(lower)) {
        console.log('\n' + theme.ivory("You're welcome! Let me know what you'd like to work on next."));
      } else if (lastRunId && (lower.includes('simpler') || lower.includes('explain') || lower.includes('summarize') || lower.includes('more details') || lower.includes('what did you find'))) {
        // Conversational follow-up referencing prior run findings
        const priorRun = approvalRuntime.getPersistedRun(lastRunId);
        if (priorRun?.nativeAgent?.finalOutput) {
          const priorSummary = priorRun.nativeAgent.finalOutput.slice(0, 300);
          console.log('\n' + theme.ivory(`In simpler terms based on our investigation in run ${lastRunId}:\n\n${priorSummary}\n\nThe code analysis identified the exact logic flow and source evidence. Would you like me to propose a verified fix or explore other areas?`));
        } else {
          console.log('\n' + theme.ivory(`Our last run was ${lastRunId}. I am ready to explain any specific part in more detail or begin a new task.`));
        }
      } else {
        try {
          const resp = await gemini.invoke(input);
          console.log('\n' + renderMarkdown(resp.text || "I'm ready to help with your repository. What engineering task would you like to perform?"));
        } catch {
          console.log('\n' + theme.ivory("I am ready to help with your repository. You can give me an engineering task like 'Investigate why test fails' or 'Fix the discount bug'."));
        }
      }
      continue;
    }

    if (intent === 'ambiguous') {
      console.log(`\nExecution intent for "${input}" is ambiguous.`);
      console.log(`  [1] Investigate (Read-only source analysis)`);
      console.log(`  [2] Fix (Propose code changes for human approval)`);
      console.log(`  [c] Cancel\n`);

      const choiceRaw = await promptUser(theme.gold('Select intent (1/2/c): '));
      const choice = choiceRaw.trim().toLowerCase();
      if (choice === '1' || choice === 'investigate' || choice === 'i') {
        intent = 'investigate';
      } else if (choice === '2' || choice === 'fix' || choice === 'f') {
        intent = 'fix';
      } else {
        console.log(theme.slate('Action cancelled.'));
        continue;
      }
    }

    if (intent === 'investigate') {
      const abortCtrl = new AbortController();
      const onSigInt = () => {
        console.log(theme.amber('\n[CANCEL] Interrupting active investigation...'));
        abortCtrl.abort();
      };
      process.once('SIGINT', onSigInt);
      try {
        const runId = await handleInvestigate(input, currentWorkspace, { signal: abortCtrl.signal });
        lastRunId = runId;
      } catch (err) {
        if (abortCtrl.signal.aborted) {
          console.log(theme.slate('Investigation cancelled by user.'));
        } else {
          console.error(theme.coral(`Investigation error: ${(err as Error).message}`));
        }
      } finally {
        process.removeListener('SIGINT', onSigInt);
      }
      continue;
    }

    if (intent === 'fix') {
      const abortCtrl = new AbortController();
      const onSigInt = () => {
        console.log(theme.amber('\n[CANCEL] Interrupting active fix run...'));
        abortCtrl.abort();
      };
      process.once('SIGINT', onSigInt);
      try {
        const result = await handleFix(input, currentWorkspace, { signal: abortCtrl.signal });
        lastRunId = result.runId;

        if (result.status === 'paused' && result.pendingApproval) {
          await promptForApprovalDecision(result.runId, result.pendingApproval, currentWorkspace, result.proposals);
        }
      } catch (err) {
        if (abortCtrl.signal.aborted) {
          console.log(theme.slate('Fix execution cancelled by user.'));
        } else {
          console.error(theme.coral(`Fix execution error: ${(err as Error).message}`));
        }
      } finally {
        process.removeListener('SIGINT', onSigInt);
      }
      continue;
    }
  }
}

/**
 * Engineering-grade framed approval prompt with safe default-to-reject.
 */
async function promptForApprovalDecision(
  runId: string,
  pendingApproval: any,
  workspace: string,
  proposals: any[]
): Promise<void> {
  while (true) {
    const promptStr = `\n${theme.gold('? Review decision:')} [${theme.sage('a')}]pprove  [${theme.coral('r')}]eject  [${theme.teal('d')}]iff  [Enter] defer ${theme.gold('?')} `;
    const ans = await promptUser(promptStr);
    const decision = ans.trim().toLowerCase();

    if (decision === 'd' || decision === 'diff') {
      handlePreview(runId);
      continue;
    }
    if (decision === 'a' || decision === 'approve') {
      await handleApprove(runId, pendingApproval.id, 'approve');
      break;
    }
    if (decision === 'r' || decision === 'reject') {
      await handleApprove(runId, pendingApproval.id, 'reject');
      break;
    }
    // Enter (empty input), 'defer', or unlisted input: explicit deferral
    console.log(theme.amber(`Run "${runId}" deferred; remains paused awaiting approval. Resumable via /approve ${runId}.`));
    break;
  }
}
