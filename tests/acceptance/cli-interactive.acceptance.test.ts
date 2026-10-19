import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';
import { stripAnsi } from '../../apps/cli/cliPresentation.js';

function sha256(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function createDisposableFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-cli-interactive-'));
  const srcDir = path.join(tmpDir, 'src');
  const testDir = path.join(tmpDir, 'test');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(testDir, { recursive: true });

  const discountPath = path.join(srcDir, 'discount.ts');
  const currencyPath = path.join(srcDir, 'currency.ts');
  const testPath = path.join(testDir, 'discount.test.ts');
  const packageJsonPath = path.join(tmpDir, 'package.json');

  // Buggy code: adds discount instead of subtracting
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
    `export function formatUSD(amount: number): string {\n` +
    `  return "$" + amount.toFixed(2);\n` +
    `}\n`,
    'utf-8'
  );

  // Regression test
  fs.writeFileSync(
    testPath,
    `import assert from "node:assert/strict";\n` +
    `import { calculateDiscount } from "../src/discount.ts";\n` +
    `const result = calculateDiscount(100, 20);\n` +
    `assert.strictEqual(result, 80, \`Expected discounted price 80, but got \${result}\`);\n` +
    `console.log("Discount test passed!");\n`,
    'utf-8'
  );

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify({ name: 'interactive-fixture', type: 'module' }, null, 2),
    'utf-8'
  );

  try {
    execSync('git init -b main', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "Aegis Test"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "test@aegis.dev"', { cwd: tmpDir, stdio: 'ignore' });
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

async function runCliAcceptanceTests() {
  console.log('==================================================================');
  console.log('  AEGIS SPRINT 6 — INTERACTIVE CLI & DEVELOPER EXPERIENCE TESTS');
  console.log('==================================================================\n');

  const aegisRoot = fs.existsSync(path.resolve('.', 'cli.ts')) ? path.resolve('.') : path.resolve(__dirname, '../..');
  const fixture = createDisposableFixture();

  try {
    // 1. Verify noninteractive CLI commands compatibility
    console.log('1. Verifying noninteractive CLI commands compatibility...');
    const helpOutput = stripAnsi(execSync('npx tsx cli.ts --help', { cwd: aegisRoot, encoding: 'utf-8' }));
    assert(helpOutput.includes('connect'), 'Help contains connect');
    assert(helpOutput.includes('investigate'), 'Help contains investigate');
    assert(helpOutput.includes('fix'), 'Help contains fix');
    assert(helpOutput.includes('preview'), 'Help contains preview command');
    assert(helpOutput.includes('interactive'), 'Help contains interactive command');
    console.log('   ✅ Noninteractive CLI help text verified with new capabilities.\n');

    // 2. Propose fix and verify patch preview with unified diff
    console.log('2. Testing native FIX proposal with human-readable unified diff preview...');
    const flawedPatch =
      `export function calculateDiscount(price: number, discountPercent: number): number {\n` +
      `  if (price < 0 || discountPercent < 0 || discountPercent > 100) {\n` +
      `    throw new Error("Invalid price or discount percentage");\n` +
      `  }\n` +
      `  const discountAmount = (price * discountPercent) / 100;\n` +
      `  // Flawed patch: divides by 2 instead of subtracting\n` +
      `  return (price + discountAmount) / 2;\n` +
      `}\n`;

    const fixEnv = {
      ...process.env,
      AEGIS_TEST_ADAPTER: '1',
      AEGIS_TEST_COMMAND: 'node --experimental-strip-types test/discount.test.ts',
      AEGIS_TEST_INITIAL_PATCH: flawedPatch,
      AEGIS_TEST_REVISED_PATCH:
        `export function calculateDiscount(price: number, discountPercent: number): number {\n` +
        `  if (price < 0 || discountPercent < 0 || discountPercent > 100) {\n` +
        `    throw new Error("Invalid price or discount percentage");\n` +
        `  }\n` +
        `  const discountAmount = (price * discountPercent) / 100;\n` +
        `  return price - discountAmount;\n` +
        `}\n`,
    };

    const rawFixOutput = execSync(`npx tsx cli.ts fix "fix discount calculation" --workspace "${fixture.tmpDir}"`, {
      cwd: aegisRoot,
      env: fixEnv,
      encoding: 'utf-8',
    });
    const fixOutput = stripAnsi(rawFixOutput);

    assert(fixOutput.includes('PROPOSED MUTATION PREVIEW'), 'Output contains PROPOSED MUTATION PREVIEW');
    assert(fixOutput.includes('--- a/src/discount.ts') || fixOutput.includes('--- a/src\\discount.ts'), 'Output contains diff header --- a/');
    assert(fixOutput.includes('+++ b/src/discount.ts') || fixOutput.includes('+++ b/src\\discount.ts'), 'Output contains diff header +++ b/');
    assert(fixOutput.includes('return price + discountAmount;') && fixOutput.includes('-'), 'Diff contains deleted line (-)');
    assert(fixOutput.includes('return (price + discountAmount) / 2;') && fixOutput.includes('+'), 'Diff contains added line (+)');

    const runIdMatch = fixOutput.match(/Run ID:\s+([a-zA-Z0-9_]+)/);
    const apprIdMatch = fixOutput.match(/Approval ID:\s+([a-zA-Z0-9_]+)/);
    assert(runIdMatch, 'Run ID found in output');
    assert(apprIdMatch, 'Approval ID found in output');

    const runId = runIdMatch[1];
    const initialApprovalId = apprIdMatch[1];
    console.log(`   ✅ Unified diff patch preview verified for Run ID: ${runId}\n`);

    // 3. Test on-demand patch preview command (`cli.ts preview <runId>`)
    console.log('3. Testing on-demand preview command: npx tsx cli.ts preview <runId>...');
    const previewOutput = stripAnsi(execSync(`npx tsx cli.ts preview ${runId}`, {
      cwd: aegisRoot,
      encoding: 'utf-8',
    }));
    assert(previewOutput.includes('PROPOSED MUTATION PREVIEW'), 'Preview command shows mutation preview');
    assert(previewOutput.includes('return price + discountAmount;'), 'Preview command shows diff');
    console.log('   ✅ On-demand patch preview command verified.\n');

    // 4. Test approval with authoritative verification report
    console.log('4. Testing approval execution and authoritative verification report...');
    const approve1Output = stripAnsi(execSync(`npx tsx cli.ts approve ${runId} ${initialApprovalId} approve`, {
      cwd: aegisRoot,
      env: fixEnv,
      encoding: 'utf-8',
    }));

    assert(approve1Output.includes('VERIFICATION EXECUTION REPORT'), 'Renders formatted verification report');
    assert(approve1Output.includes('Command   : node --experimental-strip-types test/discount.test.ts'), 'Verification command displayed');
    assert(approve1Output.includes('Exit Code : 1'), 'Non-zero exit code displayed');
    assert(approve1Output.includes('Patch application succeeded on disk, but test verification failed'), 'Distinguishes application from verification');
    assert(approve1Output.includes('REPAIR REVISION AWAITING APPROVAL'), 'Announces repair revision');

    const rev1ApprMatch = approve1Output.match(/Approval ID\s+:\s+([a-zA-Z0-9_]+)/);
    assert(rev1ApprMatch, 'Repair revision approval ID found');
    const rev1ApprovalId = rev1ApprMatch[1];
    console.log(`   ✅ Authoritative verification report cleanly rendered. Revision ID: ${rev1ApprovalId}\n`);

    // 5. Test shorthand approval (`cli.ts approve <runId> approve`)
    console.log('5. Testing shorthand approval: npx tsx cli.ts approve <runId> approve...');
    const approve2Output = stripAnsi(execSync(`npx tsx cli.ts approve ${runId} approve`, {
      cwd: aegisRoot,
      env: fixEnv,
      encoding: 'utf-8',
    }));

    assert(approve2Output.includes('VERIFICATION EXECUTION REPORT'), 'Renders verification report for revision');
    assert(approve2Output.includes('Exit Code : 0'), 'Exit code 0 displayed for passed revision');
    assert(approve2Output.includes('WORKFLOW RESUMED AND EXECUTED'), 'Workflow completed');
    console.log('   ✅ Shorthand approval successfully resumed and verified Revision 1.\n');

    // 6. Test human-readable run status report (`cli.ts run-status <runId>`) vs JSON mode
    console.log('6. Testing human-readable run status report vs --json mode...');
    const humanStatusOutput = stripAnsi(execSync(`npx tsx cli.ts run-status ${runId}`, {
      cwd: aegisRoot,
      encoding: 'utf-8',
    }));
    assert(humanStatusOutput.includes('AEGIS ENGINEERING RUN STATUS REPORT'), 'Human report title present');
    assert(humanStatusOutput.includes('REPAIR ATTEMPTS & VERIFICATION'), 'Attempt summary section present');
    assert(humanStatusOutput.includes('CHRONOLOGICAL EXECUTION TIMELINE'), 'Timeline section present');
    assert(humanStatusOutput.includes('COMPLETED'), 'Run marked completed');

    const rawJsonStatus = stripAnsi(execSync(`npx tsx cli.ts run-status ${runId} --json`, {
      cwd: aegisRoot,
      encoding: 'utf-8',
    }));
    const jsonStartIndex = rawJsonStatus.indexOf('{\n  "version"');
    const jsonCandidate = jsonStartIndex !== -1 ? rawJsonStatus.slice(jsonStartIndex) : rawJsonStatus;
    const jsonMatch = jsonCandidate.match(/\{[\s\S]*\}/);
    assert(jsonMatch, 'Found JSON object in output');
    const parsedJson = JSON.parse(jsonMatch[0]);
    assert.equal(parsedJson.runId, runId, 'JSON runId matches');
    assert.equal(parsedJson.status, 'completed', 'JSON status matches');
    assert(parsedJson.attempts && parsedJson.attempts.length >= 2, 'JSON preserves attempts');
    console.log('   ✅ Both human-readable inspection and --json automation verified.\n');

    // 7. Test interactive session entry (`cli.ts interactive`)
    console.log('7. Testing interactive console mode (menu & command dispatch)...');
    const interactiveOut = stripAnsi(execSync(`npx tsx cli.ts interactive --menu --workspace "${fixture.tmpDir}"`, {
      cwd: aegisRoot,
      input: `5\n${runId}\n6\n`,
      encoding: 'utf-8',
      timeout: 30_000,
    }));

    assert(interactiveOut.includes('AEGIS ENGINEERING HARNESS — INTERACTIVE DEVELOPER CONSOLE'), 'Interactive banner rendered');
    assert(interactiveOut.includes('Select an action:'), 'Interactive menu rendered');
    assert(interactiveOut.includes('AEGIS ENGINEERING RUN STATUS REPORT'), 'Executed inspection from menu');
    assert(interactiveOut.includes('Goodbye!'), 'Clean exit upon option 6');
    console.log('   ✅ Interactive terminal session executed and exited cleanly.\n');

    // 8. Verify unaffected file integrity
    console.log('8. Verifying untouched workspace files remain bit-for-bit unchanged...');
    const finalCurrencyHash = sha256(fs.readFileSync(fixture.currencyPath));
    assert.equal(finalCurrencyHash, fixture.currencyHash, 'Currency file remains bit-for-bit unchanged');
    console.log('   ✅ Unrelated files verified untouched.\n');

    console.log('==================================================================');
    console.log('  ALL SPRINT 6 ACCEPTANCE CHECKS PASSED (8 / 8) ✅');
    console.log('==================================================================\n');
  } finally {
    try {
      fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

runCliAcceptanceTests().catch((err) => {
  console.error('❌ Acceptance test failed:', err);
  process.exit(1);
});
