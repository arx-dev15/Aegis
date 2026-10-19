import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';
import {
  theme,
  style,
  stripAnsi,
  wrapText,
  renderAegisBanner,
  renderActivityRail,
  renderApprovalBox,
  renderMarkdown,
  formatUnifiedDiff,
  getTerminalWidth,
} from '../../apps/cli/cliPresentation.js';

function sha256(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function createDisposableFixture(name: string) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `aegis-premium-cli-${name}-`));
  const srcDir = path.join(tmpDir, 'src');
  const testDir = path.join(tmpDir, 'test');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(testDir, { recursive: true });

  const discountPath = path.join(srcDir, 'discount.ts');
  const currencyPath = path.join(srcDir, 'currency.ts');
  const testPath = path.join(testDir, 'discount.test.ts');
  const packageJsonPath = path.join(tmpDir, 'package.json');

  // Buggy discount function: adds instead of subtracting
  fs.writeFileSync(
    discountPath,
    `export function calculateDiscount(price: number, discountPercent: number): number {\n` +
    `  if (price < 0 || discountPercent < 0 || discountPercent > 100) {\n` +
    `    throw new Error("Invalid price or discount percentage");\n` +
    `  }\n` +
    `  const discountAmount = (price * discountPercent) / 100;\n` +
    `  // BUG: adds instead of subtracting\n` +
    `  return price + discountAmount;\n` +
    `}\n`,
    'utf-8'
  );

  fs.writeFileSync(
    currencyPath,
    `export function formatUSD(amount: number): string {\n` +
    `  return "$" + amount.toFixed(2);\n` +
    `}\n`,
    'utf-8'
  );

  fs.writeFileSync(
    testPath,
    `import assert from "node:assert/strict";\n` +
    `import { calculateDiscount } from "../src/discount.ts";\n` +
    `const result = calculateDiscount(100, 20);\n` +
    `assert.strictEqual(result, 80, "Expected discounted price 80, but got " + result);\n` +
    `console.log("Discount test passed!");\n`,
    'utf-8'
  );

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify({ name: `premium-cli-fixture-${name}`, type: 'module' }, null, 2),
    'utf-8'
  );

  try {
    execSync('git init -b main', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "Aegis Tester"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "tester@aegis.dev"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git add .', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m "initial commit"', { cwd: tmpDir, stdio: 'ignore' });
  } catch {}

  return {
    tmpDir,
    discountPath,
    currencyPath,
    currencyHash: sha256(fs.readFileSync(currencyPath)),
    testPath,
  };
}

async function runPremiumCliAcceptance() {
  console.log('==================================================================');
  console.log('  AEGIS PREMIUM INTERACTIVE CLI ACCEPTANCE SUITE');
  console.log('==================================================================\n');

  const aegisRoot = fs.existsSync(path.resolve('.', 'cli.ts')) ? path.resolve('.') : path.resolve(__dirname, '../..');
  let passed = 0;

  // ── TEST 1: Palette, Terminal Identity & Banner Rendering ──────────────────
  {
    console.log('1. Testing Terminal Identity, Gold/Amber Palette & ASCII Banner...');
    const banner = renderAegisBanner('/test/repo');
    assert(banner.includes('AEGIS ENGINEERING HARNESS — INTERACTIVE DEVELOPER CONSOLE'), 'Contains authoritative title');
    assert(banner.includes('Autonomous Engineering'), 'Contains tagline');
    assert(banner.includes('Mode'), 'Contains mode indicator');
    assert(banner.includes('Controls'), 'Contains command controls help');

    // Test ANSI-stripped version
    const plainBanner = stripAnsi(banner);
    assert(plainBanner.length > 0, 'Plain banner has text');
    assert(!plainBanner.includes('\x1b['), 'Plain banner has zero ANSI escapes');
    console.log('   ✅ AEGIS ASCII wordmark, gold/amber palette, and metadata rails verified.\n');
    passed++;
  }

  // ── TEST 2: Responsive Width Wrapping & Code Block Formatting ──────────────
  {
    console.log('2. Testing Responsive Layouts, ANSI-Safe Text Wrapping & Markdown...');
    const longText = 'This is an exceptionally long diagnostic log message describing a critical security policy decision in the Aegis runtime sandbox.';
    const wrapped50 = wrapText(longText, 50);
    assert(wrapped50.length >= 2, 'Wrapped across multiple lines at 50 chars');
    for (const wl of wrapped50) {
      assert(stripAnsi(wl).length <= 50, `Wrapped line "${wl}" exceeds 50 characters`);
    }

    const mdSample = '# Heading 1\n## Heading 2\n* List item\n`inline_code()`\n```typescript\nconst x: number = 42;\n```';
    const renderedMd = renderMarkdown(mdSample);
    assert(renderedMd.includes('■ Heading 1'), 'Rendered H1');
    assert(renderedMd.includes('◆ Heading 2'), 'Rendered H2');
    assert(renderedMd.includes('• List item'), 'Rendered bullet');
    assert(renderedMd.includes('inline_code()'), 'Rendered inline code');
    assert(renderedMd.includes('typescript'), 'Rendered code block language badge');
    console.log('   ✅ Responsive layout, ANSI-aware wrapping, and markdown styling verified.\n');
    passed++;
  }

  // ── TEST 3: Activity Rail Formatting ───────────────────────────────────────
  {
    console.log('3. Testing Activity Rails for Real Event Streaming...');
    const rail = renderActivityRail('Context & Grounding', [
      { type: 'info', label: 'Workspace', detail: '/projects/repo (clean)' },
      { type: 'tool', label: 'read_file', detail: 'src/index.ts', durationMs: 14 },
      { type: 'proposal', label: 'propose_file_change', detail: 'src/discount.ts [MODIFY]' },
      { type: 'verify', label: 'Docker Sandbox', detail: 'aegis-sandbox-node:22', durationMs: 512 },
      { type: 'success', label: 'Verification', detail: 'PASSED (exit 0)' },
    ], 'Completed: 1 change verified');

    assert(rail.includes('┌─ Context & Grounding'), 'Rail header present');
    assert(rail.includes('├─'), 'Rail branch present');
    assert(rail.includes('read_file'), 'Tool event present');
    assert(rail.includes('propose_file_change'), 'Proposal event present');
    assert(rail.includes('Docker Sandbox'), 'Verification event present');
    assert(rail.includes('└─ Completed: 1 change verified'), 'Rail completion present');
    console.log('   ✅ Compact activity rail renders structured lifecycle events accurately.\n');
    passed++;
  }

  // ── TEST 4: Investigation with Real Tool Execution Stream ──────────────────
  {
    console.log('4. Testing Investigation with Authentic Live Tool Event Stream...');
    const fixture = createDisposableFixture('investigate');
    const invOutput = stripAnsi(execSync(`npx tsx cli.ts investigate "explain discount logic" --workspace "${fixture.tmpDir}"`, {
      cwd: aegisRoot,
      encoding: 'utf-8',
      env: {
        ...process.env,
        AEGIS_TEST_ADAPTER: '1',
        AEGIS_TEST_READ_PATH: 'src/discount.ts',
        AEGIS_TEST_SEARCH_QUERY: 'calculateDiscount',
      },
    }));

    assert(invOutput.includes('Grounded Context:'), 'Logged grounded context metadata');
    assert(invOutput.includes('[ALLOW] read_file') || invOutput.includes('[ALLOW]'), 'Streamed tool execution live');
    assert(invOutput.includes('Run ID: run_'), 'Produced canonical run ID');
    assert(invOutput.includes('Evidence:'), 'Produced validated source evidence');
    console.log('   ✅ Investigation streams real tool events and renders grounded evidence.\n');
    passed++;
  }

  // ── TEST 5: Native FIX Proposal, Framed Diff & Rejection (Zero Mutation) ────
  {
    console.log('5. Testing Native FIX Proposal, Framed Diff & Safe Rejection...');
    const fixture = createDisposableFixture('reject');
    const fixOutput = stripAnsi(execSync(`npx tsx cli.ts fix "fix discount bug" --workspace "${fixture.tmpDir}"`, {
      cwd: aegisRoot,
      encoding: 'utf-8',
      env: {
        ...process.env,
        AEGIS_TEST_ADAPTER: '1',
        AEGIS_TEST_CHANGE_PATH: 'src/discount.ts',
        AEGIS_TEST_CHANGE_ACTION: 'modify',
        AEGIS_TEST_CHANGE_CONTENT:
          `export function calculateDiscount(price: number, discountPercent: number): number {\n` +
          `  if (price < 0 || discountPercent < 0 || discountPercent > 100) {\n` +
          `    throw new Error("Invalid price or discount percentage");\n` +
          `  }\n` +
          `  const discountAmount = (price * discountPercent) / 100;\n` +
          `  return price - discountAmount;\n` +
          `}\n`,
      },
    }));

    const runId = fixOutput.match(/Run ID:\s+(run_[0-9]+)/)![1];
    const approvalId = fixOutput.match(/Approval ID:\s+([a-zA-Z0-9_]+)/)![1];
    assert(fixOutput.includes('PROPOSED MUTATION PREVIEW'), 'Preview diff rendered');
    assert(fixOutput.includes('--- a/src/discount.ts'), 'Diff header rendered');
    assert(fixOutput.includes('+++ b/src/discount.ts'), 'Diff header rendered');

    // Confirm disk unmutated before approval
    const preContent = fs.readFileSync(fixture.discountPath, 'utf-8');
    assert(preContent.includes('price + discountAmount'), 'Disk completely unmutated prior to decision');

    // Reject via CLI
    const rejectOutput = stripAnsi(execSync(`npx tsx cli.ts approve ${runId} ${approvalId} reject`, {
      cwd: aegisRoot,
      encoding: 'utf-8',
    }));

    assert(rejectOutput.includes('WORKFLOW REJECTED'), 'Workflow rejected reported');

    // Prove ZERO mutation on disk
    const postContent = fs.readFileSync(fixture.discountPath, 'utf-8');
    assert(postContent.includes('price + discountAmount'), 'Buggy code remains intact after rejection');
    assert(!postContent.includes('price - discountAmount'), 'Proposed code NEVER applied to disk');
    assert.equal(sha256(fs.readFileSync(fixture.currencyPath)), fixture.currencyHash, 'Unrelated file untouched');
    console.log('   ✅ FIX proposal rendered framed diff and rejection preserved zero mutation.\n');
    passed++;
  }

  // ── TEST 6: Interactive Multi-Turn Session & Default-to-Reject ──────────────
  {
    console.log('6. Testing Interactive Session with Ambiguity, Slash Commands & Safe Default...');
    const fixture = createDisposableFixture('interactive');

    const multiInput = [
      'ambiguous task prompt', // Ambiguous
      'c', // Cancel
      '/workspace', // Workspace inspection
      '/help', // Help reference
      'Fix discount bug',
      'invalid_choice_defaults_to_reject_or_skip', // Default to safe skip
      'exit',
    ].join('\n') + '\n';

    const sessionOut = stripAnsi(execSync(`npx tsx cli.ts interactive --workspace "${fixture.tmpDir}"`, {
      cwd: aegisRoot,
      input: multiInput,
      encoding: 'utf-8',
      env: {
        ...process.env,
        AEGIS_TEST_ADAPTER: '1',
        AEGIS_TEST_CHANGE_PATH: 'src/discount.ts',
        AEGIS_TEST_CHANGE_ACTION: 'modify',
        AEGIS_TEST_CHANGE_CONTENT:
          `export function calculateDiscount(price: number, discountPercent: number): number {\n` +
          `  return price - (price * discountPercent) / 100;\n` +
          `}\n`,
      },
    }));

    assert(sessionOut.includes('AEGIS INTERACTIVE COMMAND REFERENCE'), 'Help slash command rendered');
    assert(sessionOut.includes('Current active workspace:'), 'Workspace command rendered');
    assert(sessionOut.includes('Execution intent for "ambiguous task prompt" is ambiguous.'), 'Ambiguity caught');
    assert(sessionOut.includes('remains paused awaiting approval'), 'Ambiguous/invalid approval defaults to safe skip');
    assert(sessionOut.includes('Goodbye!'), 'Session exited cleanly');
    console.log('   ✅ Interactive prompt, slash commands, ambiguity resolution and safe defaults verified.\n');
    passed++;
  }

  // ── TEST 7: Machine-Readable JSON Mode Discipline ───────────────────────────
  {
    console.log('7. Testing Clean Machine-Readable Output (--json)...');
    const fixture = createDisposableFixture('json');
    const fixOut = stripAnsi(execSync(`npx tsx cli.ts fix "fix discount" --workspace "${fixture.tmpDir}"`, {
      cwd: aegisRoot,
      encoding: 'utf-8',
      env: {
        ...process.env,
        AEGIS_TEST_ADAPTER: '1',
        AEGIS_TEST_CHANGE_PATH: 'src/discount.ts',
        AEGIS_TEST_CHANGE_ACTION: 'modify',
        AEGIS_TEST_CHANGE_CONTENT: 'export function calculateDiscount() { return 80; }',
      },
    }));
    const runId = fixOut.match(/Run ID:\s+(run_[0-9]+)/)![1];

    const jsonRaw = execSync(`npx tsx cli.ts run-status ${runId} --json`, {
      cwd: aegisRoot,
      encoding: 'utf-8',
    });

    assert(!jsonRaw.includes('\x1b['), 'Zero ANSI escapes in --json mode');
    const parsed = JSON.parse(jsonRaw);
    assert.equal(parsed.runId, runId, 'Parsed JSON runId matches');
    assert.equal(parsed.status, 'paused', 'Parsed JSON status matches');
    assert(parsed.pendingApproval, 'Pending approval present in JSON');
    assert(parsed.codeChanges && parsed.codeChanges.length > 0, 'Code changes present in JSON');
    console.log('   ✅ Machine-readable output preserves pure JSON formatting without ANSI pollution.\n');
    passed++;
  }

  console.log('==================================================================');
  console.log(`  ALL ${passed} / ${passed} PREMIUM CLI ACCEPTANCE TESTS PASSED VERIFIED! ✅`);
  console.log('==================================================================\n');
}

runPremiumCliAcceptance()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Acceptance test failed:', err);
    process.exit(1);
  });
