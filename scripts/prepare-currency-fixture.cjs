const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-canonical-fix-'));
fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
fs.mkdirSync(path.join(dir, 'test'), { recursive: true });

fs.writeFileSync(path.join(dir, 'src', 'formatCurrency.js'), [
  'export function formatCurrency(amount, symbol = "$") {',
  '  // BUG: missing symbol prefix',
  '  return amount.toFixed(2);',
  '}',
  ''
].join('\n'));

fs.writeFileSync(path.join(dir, 'test', 'formatCurrency.test.js'), [
  'import assert from "node:assert/strict";',
  'import { formatCurrency } from "../src/formatCurrency.js";',
  '',
  'const result = formatCurrency(25.5);',
  'assert.equal(result, "$25.50", "Expected $25.50, but got " + result);',
  'console.log("Currency test passed!");',
  ''
].join('\n'));

fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
  name: 'currency-fixture',
  version: '1.0.0',
  type: 'module',
  scripts: {
    test: 'node test/formatCurrency.test.js'
  }
}, null, 2));

execSync('git init', { cwd: dir, stdio: 'ignore' });
execSync('git config user.name "Aegis Tester"', { cwd: dir, stdio: 'ignore' });
execSync('git config user.email "tester@aegis.dev"', { cwd: dir, stdio: 'ignore' });
execSync('git add . && git commit -m "Initial commit"', { cwd: dir, stdio: 'ignore' });

console.log('CANONICAL_FIXTURE=' + dir);
