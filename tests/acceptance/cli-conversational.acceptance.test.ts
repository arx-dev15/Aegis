import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';
import { stripAnsi, formatUnifiedDiff } from '../../apps/cli/cliPresentation.js';

function sha256(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function createDisposableFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-cli-conv-'));
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
    `  return price + discountAmount;\n` +
    `}\n`,
    'utf-8'
  );

  // Unrelated file that must remain untouched
  fs.writeFileSync(
    currencyPath,
    `export function formatCurrency(amount: number): string {\n` +
    `  return "$" + amount.toFixed(2);\n` +
    `}\n`,
    'utf-8'
  );

  // Regression test
  fs.writeFileSync(
    testPath,
    `import assert from 'node:assert/strict';\n` +
    `import { calculateDiscount } from '../src/discount.ts';\n` +
    `assert.strictEqual(calculateDiscount(100, 20), 80, 'Expected discounted price 80');\n` +
    `console.log('Discount test passed!');\n`,
    'utf-8'
  );

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify({ name: 'disposable-fixture', type: 'module' }, null, 2),
    'utf-8'
  );

  const discountHash = sha256(fs.readFileSync(discountPath));
  const currencyHash = sha256(fs.readFileSync(currencyPath));

  return { tmpDir, discountPath, currencyPath, testPath, discountHash, currencyHash };
}

function runConversationalAcceptanceTests() {
  const aegisRoot = fs.existsSync(path.resolve('.', 'cli.ts')) ? path.resolve('.') : path.resolve(__dirname, '../..');
  const fixture = createDisposableFixture();

  console.log('==================================================================');
  console.log('  AEGIS SPRINT 6.5 — CONVERSATIONAL CLI & REFACTOR ACCEPTANCE');
  console.log('==================================================================\n');

  try {
    // 1. Multiple natural-language prompts in a single session
    console.log('1. Testing multiple natural-language prompts in a single conversational session...');
    const multiTurnInput = [
      'Investigate why discount calculation fails',
      'Fix the discount calculation bug',
      's', // skip immediate apply
      '/status',
      '/diff',
      '/runs',
      'exit',
    ].join('\n') + '\n';

    const multiTurnOut = stripAnsi(execSync(`npx tsx cli.ts interactive --workspace "${fixture.tmpDir}"`, {
      cwd: aegisRoot,
      input: multiTurnInput,
      encoding: 'utf-8',
      env: {
        ...process.env,
        AEGIS_TEST_ADAPTER: '1',
        AEGIS_TEST_COMMAND: `node --experimental-strip-types test/discount.test.ts`,
        AEGIS_TEST_SEARCH_QUERY: 'discount',
        AEGIS_TEST_READ_PATH: 'src/discount.ts',
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

    assert(multiTurnOut.includes('AEGIS ENGINEERING HARNESS — INTERACTIVE DEVELOPER CONSOLE'), 'Session banner rendered');
    assert(multiTurnOut.includes('Investigating "Investigate why discount calculation fails"'), 'Investigate task dispatched');
    assert(multiTurnOut.includes('Grounded investigation completed'), 'Investigation completed in session');
    assert(multiTurnOut.includes('PROPOSED MUTATION PREVIEW'), 'Fix proposal diff rendered in session');
    assert(multiTurnOut.includes('AEGIS ENGINEERING RUN STATUS REPORT'), 'Slash command /status handled in session');
    assert(multiTurnOut.includes('RECENT PERSISTED RUNS'), 'Slash command /runs handled in session');
    assert(multiTurnOut.includes('Goodbye!'), 'Clean exit handled');
    console.log('   ✅ Multiple conversational turns and slash commands executed cleanly.\n');

    // 2. Ambiguous intent confirmation (never mutates silently)
    console.log('2. Testing ambiguous natural-language input confirmation...');
    const ambiguousInput = [
      'discount calculation module',
      'c', // Cancel
      'exit',
    ].join('\n') + '\n';

    const ambOut = stripAnsi(execSync(`npx tsx cli.ts interactive --workspace "${fixture.tmpDir}"`, {
      cwd: aegisRoot,
      input: ambiguousInput,
      encoding: 'utf-8',
      env: {
        ...process.env,
        AEGIS_TEST_ADAPTER: '1',
      },
    }));

    assert(ambOut.includes('Execution intent for "discount calculation module" is ambiguous.'), 'Ambiguity detected');
    assert(ambOut.includes('[1] Investigate'), 'Offered Investigate choice');
    assert(ambOut.includes('[2] Fix'), 'Offered Fix choice');
    assert(ambOut.includes('Action cancelled.'), 'Cancelled without mutation');
    console.log('   ✅ Ambiguous prompts require explicit intent confirmation before dispatch.\n');

    // 3. Existing commands remain 100% backward-compatible
    console.log('3. Verifying noninteractive commands backward compatibility...');
    const helpOut = stripAnsi(execSync('npx tsx cli.ts --help', { cwd: aegisRoot, encoding: 'utf-8' }));
    assert(helpOut.includes('connect'), 'Help has connect');
    assert(helpOut.includes('investigate'), 'Help has investigate');
    assert(helpOut.includes('fix'), 'Help has fix');
    assert(helpOut.includes('preview'), 'Help has preview');
    assert(helpOut.includes('approve'), 'Help has approve');
    assert(helpOut.includes('run-status'), 'Help has run-status');

    // Direct fix command
    const directFixOut = stripAnsi(execSync(`npx tsx cli.ts fix "Fix discount calculation" --workspace "${fixture.tmpDir}"`, {
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

    const runIdMatch = directFixOut.match(/Run ID:\s+(run_[0-9]+)/);
    assert(runIdMatch, 'Run ID found from direct fix command');
    const directRunId = runIdMatch[1];
    console.log(`   ✅ Direct noninteractive fix command produced Run ID: ${directRunId}`);

    // 4. Verify no mutations occur without approval
    console.log('4. Verifying no mutations occur without approval...');
    const preApprovalHash = sha256(fs.readFileSync(fixture.discountPath));
    assert.equal(preApprovalHash, fixture.discountHash, 'File untouched before approval');
    console.log('   ✅ Target file remains completely unchanged on disk prior to approval.\n');

    // 5. Cross-process approval and verification
    console.log('5. Testing cross-process approval and verification execution...');
    const approveOut = stripAnsi(execSync(`npx tsx cli.ts approve ${directRunId} approve`, {
      cwd: aegisRoot,
      encoding: 'utf-8',
      env: {
        ...process.env,
        AEGIS_TEST_ADAPTER: '1',
        AEGIS_TEST_COMMAND: `node --experimental-strip-types test/discount.test.ts`,
      },
    }));

    assert(approveOut.includes('VERIFICATION EXECUTION REPORT'), 'Renders verification report');
    assert(approveOut.includes('PASSED'), 'Verification passed');
    assert(approveOut.includes('WORKFLOW RESUMED AND EXECUTED!'), 'Workflow resumed');

    // Post-approval disk verification
    const postApprovalContent = fs.readFileSync(fixture.discountPath, 'utf-8');
    assert(postApprovalContent.includes('return price - discountAmount;'), 'Disk content updated with fix');
    console.log('   ✅ Cross-process approval successfully applied patch and verified test.\n');

    // 6. JSON output is valid, ANSI-free, and machine-readable
    console.log('6. Verifying machine-readable --json status output...');
    const rawJson = stripAnsi(execSync(`npx tsx cli.ts run-status ${directRunId} --json`, {
      cwd: aegisRoot,
      encoding: 'utf-8',
    }));
    const jsonStart = rawJson.indexOf('{\n  "version"');
    const jsonText = jsonStart !== -1 ? rawJson.slice(jsonStart) : rawJson;
    const parsed = JSON.parse(jsonText.match(/\{[\s\S]*\}/)![0]);
    assert.equal(parsed.runId, directRunId, 'JSON runId matches');
    assert.equal(parsed.status, 'completed', 'JSON status completed');
    assert(parsed.testResults?.passed, 'Test results recorded');
    console.log('   ✅ Machine-readable JSON output verified.\n');

    // 7. Multi-hunk diff engine unit checks
    console.log('7. Testing robust multi-hunk diff engine with context, new, delete, and EOF newline...');
    const modDiff = formatUnifiedDiff('mod.ts', 'line1\nline2\nline3\n', 'line1\nline2_edit\nline3\n');
    assert(modDiff.diffText.includes('--- a/mod.ts'), 'Diff header a/ present');
    assert(modDiff.diffText.includes('+++ b/mod.ts'), 'Diff header b/ present');
    assert(modDiff.diffText.includes('@@ -1,3 +1,3 @@'), 'Hunk line numbers accurate');

    const newDiff = formatUnifiedDiff('new.ts', '', 'hello unicode 🚀\nworld\n');
    assert(newDiff.diffText.includes('--- /dev/null'), 'New file uses /dev/null');
    assert(newDiff.diffText.includes('+ hello unicode 🚀'), 'Unicode rendered cleanly');

    const delDiff = formatUnifiedDiff('del.ts', 'line1\n', '');
    assert(delDiff.diffText.includes('+++ /dev/null'), 'Deleted file uses /dev/null');
    assert(delDiff.diffText.includes('- line1'), 'Deleted lines shown');

    const noNlDiff = formatUnifiedDiff('no-nl.ts', 'abc', 'abc\ndef');
    assert(noNlDiff.diffText.includes('\\ No newline at end of file'), 'Handled missing trailing newline');
    console.log('   ✅ Multi-hunk unified diff generator handles new, delete, Unicode, and newline edge cases.\n');

    // 8. Untouched workspace file integrity
    console.log('8. Verifying unrelated workspace files remain bit-for-bit unchanged...');
    const postCurrencyHash = sha256(fs.readFileSync(fixture.currencyPath));
    assert.equal(postCurrencyHash, fixture.currencyHash, 'Currency file remains untouched');
    console.log('   ✅ Unrelated files verified untouched.\n');

    console.log('==================================================================');
    console.log('  ALL SPRINT 6.5 ACCEPTANCE CHECKS PASSED (8 / 8) ✅');
    console.log('==================================================================\n');
  } finally {
    try {
      fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

runConversationalAcceptanceTests();
