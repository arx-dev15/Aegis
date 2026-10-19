import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import type { CodeChange, VerificationRecord, RepairAttemptRecord } from '../../src/runtime/state.js';
import type { ActiveRun } from '../../src/runtime/approvalWorkflow.js';

// ── ANSI Color & Styling Engine (Athena Gold / Ivory / Amber / Sage / Teal) ────

const useColor = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR === '1');

function color24(r: number, g: number, b: number, fallback16: number, s: string): string {
  if (!useColor) return s;
  return `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;
}

function bgColor24(r: number, g: number, b: number, textR: number, textG: number, textB: number, s: string): string {
  if (!useColor) return `[${s}]`;
  return `\x1b[48;2;${r};${g};${b}m\x1b[38;2;${textR};${textG};${textB}m\x1b[1m ${s} \x1b[0m`;
}

export const theme = {
  // Athena signature palette
  gold: (s: string) => color24(232, 185, 75, 33, s),       // #E8B94B Warm Gold
  amber: (s: string) => color24(245, 155, 45, 33, s),      // #F59B2D Rich Amber
  ivory: (s: string) => color24(248, 245, 236, 97, s),     // #F8F5EC Soft Ivory
  sage: (s: string) => color24(135, 195, 140, 32, s),      // #87C38C Sage Green (Safe / Verified)
  teal: (s: string) => color24(75, 180, 185, 36, s),       // #4BB4B9 Soft Teal (Info / Action)
  coral: (s: string) => color24(235, 95, 90, 31, s),       // #EB5F5A Coral Red (Errors / Rejection)
  slate: (s: string) => color24(120, 125, 135, 90, s),     // #787D87 Muted Slate
  charcoal: (s: string) => color24(50, 52, 58, 90, s),     // #32343A Deep Charcoal

  // Text decorations
  bold: (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
  dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  italic: (s: string) => (useColor ? `\x1b[3m${s}\x1b[0m` : s),
  underline: (s: string) => (useColor ? `\x1b[4m${s}\x1b[0m` : s),

  // Badges
  badgeGold: (s: string) => bgColor24(232, 185, 75, 20, 20, 20, s),
  badgeSage: (s: string) => bgColor24(135, 195, 140, 20, 20, 20, s),
  badgeCoral: (s: string) => bgColor24(235, 95, 90, 255, 255, 255, s),
  badgeTeal: (s: string) => bgColor24(75, 180, 185, 20, 20, 20, s),
  badgeAmber: (s: string) => bgColor24(245, 155, 45, 20, 20, 20, s),
};

export const style = {
  ...theme,
  green: theme.sage,
  red: theme.coral,
  yellow: theme.amber,
  blue: theme.teal,
  magenta: theme.gold,
  cyan: theme.teal,
  gray: theme.slate,
  bgGreen: (s: string) => theme.badgeSage(s),
  bgRed: (s: string) => theme.badgeCoral(s),
  bgYellow: (s: string) => theme.badgeGold(s),
  bgBlue: (s: string) => theme.badgeTeal(s),
};

export function stripAnsi(str: string): string {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

export function getTerminalWidth(): number {
  return process.stdout.columns && process.stdout.columns > 20 ? Math.min(process.stdout.columns, 110) : 80;
}

export function wrapText(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];
  const lines = text.split(/\r?\n/);
  const result: string[] = [];

  for (const rawLine of lines) {
    if (stripAnsi(rawLine).length <= maxWidth) {
      result.push(rawLine);
      continue;
    }

    const words = rawLine.split(' ');
    let currentLine = '';
    let currentVisLen = 0;

    for (const word of words) {
      const wordVisLen = stripAnsi(word).length;
      if (currentVisLen === 0) {
        currentLine = word;
        currentVisLen = wordVisLen;
      } else if (currentVisLen + 1 + wordVisLen <= maxWidth) {
        currentLine += ' ' + word;
        currentVisLen += 1 + wordVisLen;
      } else {
        result.push(currentLine);
        currentLine = word;
        currentVisLen = wordVisLen;
      }
    }
    if (currentLine) {
      result.push(currentLine);
    }
  }

  return result;
}

export function drawBox(
  title: string,
  lines: string[],
  borderColor: (s: string) => string = theme.gold,
  options: { rounded?: boolean } = {}
): string {
  const width = getTerminalWidth();
  const innerWidth = width - 4;
  const isRounded = options.rounded ?? true;

  const topLeft = isRounded ? '╭─ ' : '┌─ ';
  const topRight = isRounded ? '╮' : '┐';
  const bottomLeft = isRounded ? '╰' : '└';
  const bottomRight = isRounded ? '╯' : '┘';

  const titleText = title ? `${title} ` : '';
  const titleVisLen = stripAnsi(titleText).length;
  const topBorder = borderColor(topLeft) + style.bold(titleText) + borderColor('─'.repeat(Math.max(0, innerWidth - titleVisLen - 1)) + topRight);
  const bottomBorder = borderColor(bottomLeft + '─'.repeat(innerWidth + 2) + bottomRight);

  const content: string[] = [];
  for (const l of lines) {
    const wrapped = wrapText(l, innerWidth);
    for (const wl of wrapped) {
      const plain = stripAnsi(wl);
      const padding = Math.max(0, innerWidth - plain.length);
      content.push(borderColor('│ ') + wl + ' '.repeat(padding) + borderColor(' │'));
    }
  }

  return [topBorder, ...content, bottomBorder].join('\n');
}

// ── Stream & TTY Line Reader ─────────────────────────────────────────────────

let activeRl: readline.Interface | null = null;
let lineIterator: AsyncIterableIterator<string> | null = null;

export async function promptUser(query: string): Promise<string> {
  process.stdout.write(query);
  if (process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question('', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    });
  } else {
    if (!activeRl) {
      activeRl = readline.createInterface({
        input: process.stdin,
        crlfDelay: Infinity,
      });
      lineIterator = activeRl[Symbol.asyncIterator]();
    }
    const next = await lineIterator!.next();
    if (next.done) return '';
    return (next.value ?? '').trim();
  }
}

export function closePrompt(): void {
  if (activeRl) {
    activeRl.close();
    activeRl = null;
    lineIterator = null;
  }
}

// ── Robust Multi-Hunk Unified Diff Engine ────────────────────────────────────

export interface DiffLine {
  type: 'add' | 'del' | 'same';
  text: string;
}

export function splitTextLines(text: string): { lines: string[]; hasTrailingNewline: boolean } {
  if (!text) return { lines: [], hasTrailingNewline: false };
  const hasTrailingNewline = text.endsWith('\n') || text.endsWith('\r\n');
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (hasTrailingNewline && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return { lines, hasTrailingNewline };
}

export function computeLineDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const n = oldLines.length;
  const m = newLines.length;

  if (n === 0 && m === 0) return [];
  if (n === 0) return newLines.map((text) => ({ type: 'add', text }));
  if (m === 0) return oldLines.map((text) => ({ type: 'del', text }));

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  let i = n;
  let j = m;
  const result: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'same', text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', text: newLines[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({ type: 'del', text: oldLines[i - 1] });
      i--;
    }
  }

  return result;
}

export interface HunkLine {
  type: 'add' | 'del' | 'same' | 'no-newline';
  text: string;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: HunkLine[];
}

export function generateHunks(
  diffLines: DiffLine[],
  contextSize = 3,
  oldHasTrailingNewline = true,
  newHasTrailingNewline = true
): DiffHunk[] {
  const changeIndices: number[] = [];
  for (let idx = 0; idx < diffLines.length; idx++) {
    if (diffLines[idx].type !== 'same') {
      changeIndices.push(idx);
    }
  }

  if (changeIndices.length === 0) return [];

  const hunkRanges: Array<{ startIdx: number; endIdx: number }> = [];
  let currentStart = Math.max(0, changeIndices[0] - contextSize);
  let currentEnd = Math.min(diffLines.length - 1, changeIndices[0] + contextSize);

  for (let k = 1; k < changeIndices.length; k++) {
    const chIdx = changeIndices[k];
    const nextStart = Math.max(0, chIdx - contextSize);
    const nextEnd = Math.min(diffLines.length - 1, chIdx + contextSize);

    if (nextStart <= currentEnd + 1) {
      currentEnd = Math.max(currentEnd, nextEnd);
    } else {
      hunkRanges.push({ startIdx: currentStart, endIdx: currentEnd });
      currentStart = nextStart;
      currentEnd = nextEnd;
    }
  }
  hunkRanges.push({ startIdx: currentStart, endIdx: currentEnd });

  const hunks: DiffHunk[] = [];
  let runningOldLine = 1;
  let runningNewLine = 1;
  let currentDiffIdx = 0;

  for (const range of hunkRanges) {
    while (currentDiffIdx < range.startIdx) {
      if (diffLines[currentDiffIdx].type === 'del' || diffLines[currentDiffIdx].type === 'same') {
        runningOldLine++;
      }
      if (diffLines[currentDiffIdx].type === 'add' || diffLines[currentDiffIdx].type === 'same') {
        runningNewLine++;
      }
      currentDiffIdx++;
    }

    const hunkOldStart = runningOldLine;
    const hunkNewStart = runningNewLine;
    let hunkOldCount = 0;
    let hunkNewCount = 0;
    const hunkLines: HunkLine[] = [];

    while (currentDiffIdx <= range.endIdx) {
      const line = diffLines[currentDiffIdx];
      hunkLines.push({ type: line.type, text: line.text });

      if (line.type === 'del') {
        hunkOldCount++;
        runningOldLine++;
      } else if (line.type === 'add') {
        hunkNewCount++;
        runningNewLine++;
      } else {
        hunkOldCount++;
        hunkNewCount++;
        runningOldLine++;
        runningNewLine++;
      }

      if (currentDiffIdx === diffLines.length - 1) {
        if (!oldHasTrailingNewline && (line.type === 'del' || line.type === 'same')) {
          hunkLines.push({ type: 'no-newline', text: '\\ No newline at end of file' });
        }
        if (!newHasTrailingNewline && (line.type === 'add' || line.type === 'same')) {
          hunkLines.push({ type: 'no-newline', text: '\\ No newline at end of file' });
        }
      }

      currentDiffIdx++;
    }

    hunks.push({
      oldStart: hunkOldStart,
      oldCount: hunkOldCount,
      newStart: hunkNewStart,
      newCount: hunkNewCount,
      lines: hunkLines,
    });
  }

  return hunks;
}

export function formatUnifiedDiff(
  pathLabel: string,
  oldText: string,
  newText: string,
  options: { maxLines?: number; contextSize?: number } = {}
): { diffText: string; additions: number; deletions: number; isTruncated: boolean } {
  const maxLines = options.maxLines ?? 400;
  const contextSize = options.contextSize ?? 3;
  const isNewFile = !oldText && Boolean(newText);
  const isDeletedFile = Boolean(oldText) && !newText;

  const { lines: oldLines, hasTrailingNewline: oldHasTrailingNewline } = splitTextLines(oldText);
  const { lines: newLines, hasTrailingNewline: newHasTrailingNewline } = splitTextLines(newText);

  const diffLines = computeLineDiff(oldLines, newLines);

  let additions = 0;
  let deletions = 0;
  for (const l of diffLines) {
    if (l.type === 'add') additions++;
    if (l.type === 'del') deletions++;
  }

  const hunks = generateHunks(diffLines, contextSize, oldHasTrailingNewline, newHasTrailingNewline);

  const output: string[] = [];
  if (isNewFile) {
    output.push(theme.slate(`--- /dev/null`));
    output.push(theme.slate(`+++ b/${pathLabel}`));
  } else if (isDeletedFile) {
    output.push(theme.slate(`--- a/${pathLabel}`));
    output.push(theme.slate(`+++ /dev/null`));
  } else {
    output.push(theme.slate(`--- a/${pathLabel}`));
    output.push(theme.slate(`+++ b/${pathLabel}`));
  }

  let totalLinesRendered = output.length;
  let isTruncated = false;

  for (const hunk of hunks) {
    if (totalLinesRendered >= maxLines) {
      isTruncated = true;
      break;
    }
    output.push(theme.teal(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`));
    totalLinesRendered++;

    for (const line of hunk.lines) {
      if (totalLinesRendered >= maxLines) {
        isTruncated = true;
        break;
      }
      if (line.type === 'add') {
        output.push(theme.sage(`+ ${line.text}`));
      } else if (line.type === 'del') {
        output.push(theme.coral(`- ${line.text}`));
      } else if (line.type === 'no-newline') {
        output.push(theme.slate(line.text));
      } else {
        output.push(theme.slate(`  ${line.text}`));
      }
      totalLinesRendered++;
    }
  }

  if (isTruncated) {
    output.push(theme.amber(`... [diff truncated: exceeded ${maxLines} display lines]`));
  }

  return {
    diffText: output.join('\n'),
    additions,
    deletions,
    isTruncated,
  };
}

// ── Patch Preview Engine ─────────────────────────────────────────────────────

export interface PatchFilePreview {
  path: string;
  action: 'modify' | 'add' | 'delete';
  additions: number;
  deletions: number;
  isDirtyBeforeApply: boolean;
  isStale: boolean;
  diffText: string;
  summary?: string;
  contradictionWarning?: string;
}

export function generatePatchPreview(workspace: string, changes: CodeChange[]): {
  files: PatchFilePreview[];
  totalAdditions: number;
  totalDeletions: number;
  hasDirtyConflicts: boolean;
  hasStaleFiles: boolean;
} {
  const files: PatchFilePreview[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;
  let hasDirtyConflicts = false;
  let hasStaleFiles = false;

  let dirtyFiles: string[] = [];
  try {
    const gitStatus = execSync('git status --porcelain', { cwd: workspace, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    dirtyFiles = gitStatus
      .split('\n')
      .map((line) => line.trim().slice(3).trim().replace(/\\/g, '/'))
      .filter(Boolean);
  } catch {}

  for (const change of changes) {
    const fullPath = path.resolve(workspace, change.path);
    const relPath = change.path.replace(/\\/g, '/');
    let originalContent = '';
    const fileExists = fs.existsSync(fullPath);

    let contradictionWarning: string | undefined;
    if (change.action === 'add' && fileExists) {
      contradictionWarning = `CONTRADICTION: Operation is labeled CREATE, but target already exists on disk.`;
    } else if (change.action === 'modify' && !fileExists) {
      contradictionWarning = `CONTRADICTION: Operation is labeled MODIFY, but target does not exist on disk.`;
    } else if (change.action === 'delete' && !fileExists) {
      contradictionWarning = `CONTRADICTION: Operation is labeled DELETE, but target does not exist on disk.`;
    }

    if (change.action === 'add' && !fileExists) {
      originalContent = '';
    } else if (fileExists) {
      try {
        originalContent = fs.readFileSync(fullPath, 'utf-8');
      } catch {}
    }

    const proposedContent = change.action === 'delete' ? '' : (change.content ?? '');
    const { diffText, additions, deletions } = formatUnifiedDiff(relPath, originalContent, proposedContent);

    const isDirtyBeforeApply = dirtyFiles.some((df) => df === relPath || relPath.endsWith(df));
    if (isDirtyBeforeApply) hasDirtyConflicts = true;

    totalAdditions += additions;
    totalDeletions += deletions;

    files.push({
      path: relPath,
      action: change.action as any,
      additions,
      deletions,
      isDirtyBeforeApply,
      isStale: false,
      diffText,
      summary: change.summary,
      contradictionWarning,
    });
  }

  return {
    files,
    totalAdditions,
    totalDeletions,
    hasDirtyConflicts,
    hasStaleFiles,
  };
}

export function renderPatchPreview(workspace: string, changes: CodeChange[]): string {
  const preview = generatePatchPreview(workspace, changes);
  const lines: string[] = [];

  lines.push(
    style.bold(`PROPOSED MUTATION PREVIEW`) +
      ` (${changes.length} file(s), ` +
      theme.sage(`+${preview.totalAdditions}`) +
      ', ' +
      theme.coral(`-${preview.totalDeletions}`) +
      ')'
  );
  lines.push('');

  for (const f of preview.files) {
    const actionLabel = f.action === 'add' ? theme.badgeSage('CREATE') : f.action === 'delete' ? theme.badgeCoral('DELETE') : theme.badgeAmber('MODIFY');
    const statLabel = `(${theme.sage(`+${f.additions}`)}, ${theme.coral(`-${f.deletions}`)})`;
    lines.push(`${actionLabel} ${theme.bold(theme.ivory(f.path))} ${statLabel}`);
    if (f.summary) {
      lines.push(theme.slate(`  Summary: ${f.summary}`));
    }
    if (f.contradictionWarning) {
      lines.push(theme.coral(`  ❌ ${f.contradictionWarning}`));
    }
    if (f.isDirtyBeforeApply) {
      lines.push(theme.amber(`  ⚠️  DIRTY FILE WARNING: Path has uncommitted changes outside this run.`));
    }
    lines.push('');
    lines.push(f.diffText);
    lines.push('');
  }

  return lines.join('\n');
}

// ── Markdown & Code-Block Renderer ───────────────────────────────────────────

export function renderMarkdown(markdownText: string): string {
  if (!markdownText) return '';

  const lines = markdownText.split(/\r?\n/);
  const output: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeBlockLines = [];
      } else {
        inCodeBlock = false;
        const width = Math.min(getTerminalWidth(), 90);
        const innerWidth = width - 4;
        const tag = codeBlockLang ? ` [${codeBlockLang}] ` : ' ';
        output.push(theme.slate('┌─') + theme.teal(theme.bold(tag)) + theme.slate('─'.repeat(Math.max(0, innerWidth - tag.length)) + '┐'));
        for (const cl of codeBlockLines) {
          const plain = stripAnsi(cl);
          const pad = Math.max(0, innerWidth - plain.length);
          output.push(theme.slate('│ ') + theme.ivory(cl) + ' '.repeat(pad) + theme.slate(' │'));
        }
        output.push(theme.slate('└' + '─'.repeat(innerWidth + 2) + '┘'));
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      output.push('');
      output.push(theme.bold(theme.gold(`■ ${line.slice(2).trim()}`)));
      output.push(theme.slate('─'.repeat(Math.min(50, getTerminalWidth() - 4))));
      continue;
    }
    if (line.startsWith('## ')) {
      output.push('');
      output.push(theme.bold(theme.ivory(`◆ ${line.slice(3).trim()}`)));
      continue;
    }
    if (line.startsWith('### ')) {
      output.push(theme.bold(theme.teal(`◇ ${line.slice(4).trim()}`)));
      continue;
    }

    // Inline formatting: `code`, **bold**
    let formatted = line;
    formatted = formatted.replace(/`([^`]+)`/g, (_m, code) => theme.teal(code));
    formatted = formatted.replace(/\*\*([^\*]+)\*\*/g, (_m, bold) => theme.bold(theme.ivory(bold)));

    // Bullet points
    if (formatted.trim().startsWith('* ') || formatted.trim().startsWith('- ')) {
      output.push(`  ${theme.gold('•')} ${formatted.trim().slice(2)}`);
      continue;
    }

    output.push(formatted);
  }

  return output.join('\n');
}

// ── Activity Rail Presentation ───────────────────────────────────────────────

export interface ActivityRailItem {
  type?: 'info' | 'tool' | 'verify' | 'proposal' | 'success' | 'warn' | 'error';
  label: string;
  detail?: string;
  durationMs?: number;
}

export function renderActivityRail(title: string, items: ActivityRailItem[], summary?: string): string {
  const lines: string[] = [];
  lines.push(theme.gold(`┌─ ${theme.bold(title)}`));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLast = i === items.length - 1 && !summary;
    const branch = isLast ? '└─' : '├─';

    let glyph = '◇';
    let labelColor = theme.ivory;
    if (item.type === 'tool') { glyph = '🛠️ '; labelColor = theme.teal; }
    else if (item.type === 'proposal') { glyph = '📝'; labelColor = theme.amber; }
    else if (item.type === 'verify') { glyph = '🧪'; labelColor = theme.teal; }
    else if (item.type === 'success') { glyph = '✅'; labelColor = theme.sage; }
    else if (item.type === 'warn') { glyph = '⚠️ '; labelColor = theme.amber; }
    else if (item.type === 'error') { glyph = '❌'; labelColor = theme.coral; }

    let line = `${theme.slate('│')}  ${theme.slate(branch)} ${glyph} ${labelColor(item.label)}`;
    if (item.detail) {
      line += theme.slate(` — ${item.detail}`);
    }
    if (item.durationMs !== undefined) {
      line += theme.slate(` (${item.durationMs}ms)`);
    }
    lines.push(line);
  }

  if (summary) {
    lines.push(`${theme.gold('└─')} ${theme.ivory(theme.bold(summary))}`);
  }

  return lines.join('\n');
}

// ── Framed Approval Box ──────────────────────────────────────────────────────

export function renderApprovalBox(params: {
  runId: string;
  approvalId: string;
  action: string;
  target: string;
  description: string;
  workspace: string;
  codeChanges: CodeChange[];
}): string {
  const width = getTerminalWidth();
  const innerWidth = width - 4;
  const border = theme.amber;

  const header = border('╭─ ') + theme.bold(theme.amber('⏸️  HUMAN APPROVAL REQUIRED — MUTATION GATE')) + ' ' + border('─'.repeat(Math.max(0, innerWidth - 46)) + '╮');
  const divider = border('├' + '─'.repeat(innerWidth + 2) + '┤');
  const footer = border('╰' + '─'.repeat(innerWidth + 2) + '╯');

  const metaRows = [
    `${theme.gold('Run ID')}      : ${theme.ivory(params.runId)}`,
    `${theme.gold('Approval ID')} : ${theme.ivory(params.approvalId)}`,
    `${theme.gold('Action')}      : ${theme.teal(params.action)}`,
    `${theme.gold('Target')}      : ${theme.ivory(params.target)}`,
    `${theme.gold('Reason')}      : ${theme.ivory(params.description)}`,
    `${theme.gold('Workspace')}   : ${theme.slate(params.workspace)}`,
  ];

  const diffPreview = renderPatchPreview(params.workspace, params.codeChanges);

  const boxLines: string[] = [
    header,
    ...metaRows.map((l) => {
      const plain = stripAnsi(l);
      const pad = Math.max(0, innerWidth - plain.length);
      return border('│ ') + l + ' '.repeat(pad) + border(' │');
    }),
    divider,
  ];

  for (const dl of diffPreview.split('\n')) {
    const wrapped = wrapText(dl, innerWidth);
    for (const wl of wrapped) {
      const plain = stripAnsi(wl);
      const pad = Math.max(0, innerWidth - plain.length);
      boxLines.push(border('│ ') + wl + ' '.repeat(pad) + border(' │'));
    }
  }

  boxLines.push(footer);
  return boxLines.join('\n');
}

// ── Authoritative Verification Presentation ───────────────────────────────────

export function renderVerificationReport(verification?: VerificationRecord, attempts?: RepairAttemptRecord[]): string {
  if (!verification) {
    return theme.slate('No authoritative verification record available.');
  }

  const isPassed = verification.status === 'passed';
  const statusBadge = isPassed ? theme.badgeSage('PASSED') : theme.badgeCoral('FAILED');
  const title = `VERIFICATION EXECUTION REPORT — ${statusBadge}`;

  const lines: string[] = [
    `${style.bold('Command   :')} ${verification.command}`,
    `${style.bold('Workspace :')} ${verification.workspace}`,
    `${style.bold('Exit Code :')} ${verification.exitCode ?? 'N/A'} (Duration: ${verification.durationMs}ms)`,
    `${style.bold('Status    :')} ${isPassed ? theme.sage('Passed (Verified Authoritative)') : theme.coral('Failed (Non-zero exit code)')}`,
  ];

  if (verification.approvalId) {
    lines.push(`${style.bold('Approval  :')} ${verification.approvalId}`);
  }

  lines.push('');

  if (!isPassed) {
    lines.push(theme.amber('⚠️  NOTE: Patch application succeeded on disk, but test verification failed.'));
    lines.push('');
  }

  if (attempts && attempts.length > 0) {
    lines.push(style.bold('REPAIR ATTEMPT HISTORY:'));
    for (const att of attempts) {
      const attPassed = att.status === 'verified_passed';
      const attFailed = att.status === 'verified_failed';
      const icon = attPassed ? '✅' : attFailed ? '❌' : '⏸️';
      const attCmd = att.verification ? `${att.verification.command} (exit ${att.verification.exitCode})` : 'pending';
      lines.push(`  Attempt ${att.attemptNumber} [${att.approvalId}]: ${icon} ${att.status} (${attCmd})`);
    }
    lines.push('');
  }

  if (verification.stdout) {
    lines.push(style.bold('STDOUT:'));
    const stdoutLines = verification.stdout.trim().split(/\r?\n/).slice(-15);
    lines.push(...stdoutLines.map((l) => `  ${theme.slate(l)}`));
    lines.push('');
  }

  if (verification.stderr) {
    lines.push(style.bold(theme.coral('STDERR:')));
    const stderrLines = verification.stderr.trim().split(/\r?\n/).slice(-15);
    lines.push(...stderrLines.map((l) => `  ${theme.coral(l)}`));
    lines.push('');
  }

  lines.push(
    theme.dim(
      'Note: Successful patch application indicates disk mutation was applied. Authoritative verification indicates test command execution.'
    )
  );

  return drawBox(title, lines, isPassed ? theme.sage : theme.coral);
}

// ── Chronological Execution Timeline ─────────────────────────────────────────

export function renderTimeline(run: ActiveRun): string {
  const allItems: Array<{ timestamp: number; icon: string; message: string }> = [];

  if (run.events) {
    for (const ev of run.events) {
      let icon = '•';
      if (ev.type.includes('INVESTIGATE')) icon = '🔎';
      if (ev.type.includes('PROPOSAL')) icon = '📝';
      if (ev.type.includes('APPROVAL_REQUIRED')) icon = '⏸️';
      if (ev.type.includes('APPROVED')) icon = '✅';
      if (ev.type.includes('REJECTED')) icon = '⛔';
      if (ev.type.includes('APPLIED')) icon = '💾';
      if (ev.type.includes('VERIFICATION')) icon = '🧪';
      if (ev.type.includes('REPAIR')) icon = '🔄';
      allItems.push({
        timestamp: ev.timestamp,
        icon,
        message: `${ev.type}: ${JSON.stringify((ev as any).payload || (ev as any).data || {})}`,
      });
    }
  }

  if (run.nativeAgent?.toolCalls) {
    for (const tc of run.nativeAgent.toolCalls) {
      allItems.push({
        timestamp: Date.now() - tc.durationMs,
        icon: '🛠️',
        message: `Tool: ${tc.name} (${tc.durationMs}ms)`,
      });
    }
  }

  if (run.state.executionLog) {
    for (const log of run.state.executionLog) {
      let icon = '•';
      if (log.includes('HUMAN-APPROVAL-GATE')) icon = '⏸️';
      if (log.includes('DEV-APPLY')) icon = '💾';
      if (log.includes('CHANGE-EVIDENCE')) icon = '🛡️';
      if (log.includes('TEST-TOOL')) icon = '🧪';
      if (log.includes('NATIVE-REPAIR')) icon = '🔄';
      allItems.push({
        timestamp: Date.now(),
        icon,
        message: log,
      });
    }
  }

  const seen = new Set<string>();
  const uniqueItems: typeof allItems = [];
  for (const item of allItems) {
    if (!seen.has(item.message)) {
      seen.add(item.message);
      uniqueItems.push(item);
    }
  }

  if (uniqueItems.length === 0) {
    return theme.slate('  No timeline events recorded.');
  }

  const lines: string[] = [style.bold('  CHRONOLOGICAL EXECUTION TIMELINE:')];
  for (const item of uniqueItems) {
    lines.push(`    ${item.icon} ${item.message}`);
  }
  return lines.join('\n');
}

// ── Human-Readable Run Status Presentation ───────────────────────────────────

export function renderRunStatusReport(run: ActiveRun): string {
  const width = getTerminalWidth();
  const sep = theme.gold('='.repeat(width));
  const thinSep = theme.slate('-'.repeat(width));

  const statusColor =
    run.state.status === 'completed'
      ? theme.sage
      : run.state.status === 'failed'
      ? theme.coral
      : run.state.status === 'paused'
      ? theme.amber
      : theme.teal;

  const lines: string[] = [
    sep,
    style.bold(`  AEGIS ENGINEERING RUN STATUS REPORT`),
    sep,
    `  ${style.bold('Run ID        :')} ${run.runId}`,
    `  ${style.bold('Status        :')} ${statusColor(run.state.status.toUpperCase())}`,
    `  ${style.bold('Kind          :')} ${run.state.executionKind || 'N/A'}`,
    `  ${style.bold('Workspace     :')} ${run.state.workspace}`,
    `  ${style.bold('Task / Goal   :')} ${run.state.task}`,
    thinSep,
  ];

  if (run.pendingApproval) {
    lines.push(
      theme.amber(style.bold('  ⚠️  PENDING APPROVAL:')),
      `     Approval ID : ${run.pendingApproval.id}`,
      `     Action      : ${run.pendingApproval.action}`,
      `     Target      : ${run.pendingApproval.target}`,
      `     Reason      : ${run.pendingApproval.description}`,
      thinSep
    );
  }

  if (run.state.codeChanges && run.state.codeChanges.length > 0) {
    lines.push(
      style.bold('  PROPOSED CODE CHANGES:'),
      ...run.state.codeChanges.map((c) => `     - ${c.action.toUpperCase()} ${c.path}${c.summary ? ` (${c.summary})` : ''}`),
      thinSep
    );
  }

  if (run.attempts && run.attempts.length > 0) {
    lines.push(style.bold('  REPAIR ATTEMPTS & VERIFICATION:'));
    for (const att of run.attempts) {
      const attStatus =
        att.status === 'verified_passed'
          ? theme.sage('PASSED ✅')
          : att.status === 'verified_failed'
          ? theme.coral('FAILED ❌')
          : att.status === 'proposed'
          ? theme.amber('PENDING APPROVAL ⏸️')
          : att.status;
      const cmdInfo = att.verification ? `${att.verification.command} (exit ${att.verification.exitCode})` : 'verification pending';
      lines.push(`     Attempt ${att.attemptNumber} [${att.approvalId}]: ${attStatus} — ${cmdInfo}`);
    }
    thinSep;
  }

  if (run.state.testResults?.verificationRecord) {
    lines.push(
      renderVerificationReport(run.state.testResults.verificationRecord, run.attempts),
      thinSep
    );
  }

  if (run.state.errors && run.state.errors.length > 0) {
    lines.push(
      style.bold(theme.coral('  RECORDED ERRORS:')),
      ...run.state.errors.map((e) => theme.coral(`     ! ${e}`)),
      thinSep
    );
  }

  lines.push(renderTimeline(run));
  lines.push(sep);

  return lines.join('\n');
}

// ── Custom AEGIS ASCII Banner & Console Header ───────────────────────────────

export function renderAegisBanner(workspace?: string, mode = 'semi-auto (Guarded Tool Execution)'): string {
  const width = getTerminalWidth();
  const sep = theme.gold('='.repeat(width));

  if (!useColor) {
    return [
      `================================================================`,
      `  AEGIS ENGINEERING HARNESS — INTERACTIVE DEVELOPER CONSOLE`,
      `  Autonomous Engineering • Verified Docker Execution • Human Authorization`,
      `================================================================`,
      ...(workspace ? [`  Active Workspace : ${workspace}`] : []),
      `  Execution Mode   : ${mode}`,
      `  Controls         : Type any task naturally or /help for slash commands`,
      `================================================================`,
    ].join('\n');
  }

  const art = [
    theme.gold(`   █████╗ ███████╗ ██████╗ ██╗███████╗`),
    theme.gold(`  ██╔══██╗██╔════╝██╔════╝ ██║██╔════╝`),
    theme.amber(`  ███████║█████╗  ██║  ███╗██║███████╗`),
    theme.amber(`  ██╔══██║██╔══╝  ██║   ██║██║╚════██║`),
    theme.amber(`  ██║  ██║███████╗╚██████╔╝██║███████║`),
    theme.gold(`  ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝`),
  ];

  return [
    '',
    ...art,
    '',
    theme.ivory(style.bold('  AEGIS ENGINEERING HARNESS — INTERACTIVE DEVELOPER CONSOLE')),
    theme.slate('  Autonomous Engineering • Verified Docker Execution • Human Authorization'),
    theme.slate('  ' + '─'.repeat(Math.min(width - 4, 76))),
    ...(workspace ? [`  ${theme.gold('◆ Workspace')} : ${theme.ivory(workspace)}`] : []),
    `  ${theme.gold('◆ Mode')}      : ${theme.sage(mode)}`,
    `  ${theme.gold('◆ Controls')}  : Type any task naturally or ${theme.teal('/help')} for slash commands`,
    '',
  ].join('\n');
}

export function renderActionMenu(): string {
  return [
    `Select an action:`,
    `  Type any task naturally (e.g. "Fix the discount bug", "Investigate API error")`,
    `  Or select an option [1-6] or slash command (/help, /status, /diff, /runs, /exit):`,
    `  [1] Investigate (Read-only analysis with source evidence)`,
    `  [2] Fix (Propose bug fix with patch preview & verification)`,
    `  [3] Preview Pending Run Diff`,
    `  [4] Approve / Reject Pending Run`,
    `  [5] Inspect Persisted Run Status`,
    `  [6] Exit`,
  ].join('\n');
}

export function renderConsoleBanner(
  workspace: string,
  mode = 'semi-auto (Guarded Tool Execution)',
  options: { menuMode?: boolean } = {}
): string {
  const banner = renderAegisBanner(workspace, mode);
  if (options.menuMode) {
    return banner + '\n' + renderActionMenu() + '\n';
  }
  const hint = `  ${theme.slate('Type any engineering task naturally (e.g. "Fix discount bug", "Investigate API error").')}\n  ${theme.slate('Use')} ${theme.teal('/menu')} ${theme.slate('for quick numeric actions.')}\n`;
  return banner + '\n' + hint;
}

export function renderSessionBanner(activeWorkspace: string, mode = 'semi-auto (Guarded Tool Execution)'): string {
  return renderAegisBanner(activeWorkspace, mode);
}

export function renderHelp(): string {
  const width = getTerminalWidth();
  const innerWidth = width - 4;
  const border = theme.gold;

  const header = border('╔' + '═'.repeat(innerWidth + 2) + '╗');
  const divider = border('╠' + '═'.repeat(innerWidth + 2) + '╣');
  const footer = border('╚' + '═'.repeat(innerWidth + 2) + '╝');

  const contentLines: string[] = [
    `  ${theme.bold(theme.ivory('AEGIS INTERACTIVE COMMAND REFERENCE'))}`,
    '',
    `  ${theme.gold('Natural Language Tasks:')}`,
    `    Type any engineering task or query directly`,
    `    • "Fix the discount calculation bug in src/discount.ts"`,
    `    • "Investigate why test/api.test.ts is failing"`,
    '',
    `  ${theme.gold('Core Slash Commands:')}`,
    `    ${theme.teal('/help')}                 Display this command reference`,
    `    ${theme.teal('/investigate <query>')} Run read-only native investigation`,
    `    ${theme.teal('/fix <task>')}          Propose native fix with Docker verification`,
    `    ${theme.teal('/status [runId]')}      Inspect full execution and evidence state`,
    `    ${theme.teal('/diff [runId]')}        Display formatted unified diff`,
    `    ${theme.teal('/approve [runId]')}     Approve proposal and resume execution`,
    `    ${theme.teal('/reject [runId]')}      Reject proposal (guaranteed zero disk mutation)`,
    `    ${theme.teal('/runs [limit]')}        List recent persisted runs`,
    `    ${theme.teal('/workspace [path]')}    Show or switch active repository workspace`,
    `    ${theme.teal('/clear')}               Clear screen and re-render header`,
    `    ${theme.teal('/menu')}                Show quick numeric options menu [1-6]`,
    `    ${theme.teal('/exit')} or ${theme.teal('/quit')}       Terminate interactive session`,
  ];

  const formattedLines = contentLines.map((l) => {
    const plain = stripAnsi(l);
    const pad = Math.max(0, innerWidth - plain.length);
    return border('║ ') + l + ' '.repeat(pad) + border(' ║');
  });

  return [header, ...formattedLines, footer].join('\n');
}
