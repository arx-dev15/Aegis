'use strict';
// Dependency-light regression for the canonical production tester boundary.
// Uses TypeScript only for transpilation; sandbox responses are injected instead
// of invoking Docker or an external model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'workflows', 'nodes', 'testerNode.ts'), 'utf8');
const compiled = ts.transpileModule(src, {
  fileName: 'testerNode.ts',
  reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
});
assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, 'TypeScript syntax');
let sandboxResponse;
let modelCalls = 0;
let shellCalls = 0;
class FakeTesterAgent {
  async test() { modelCalls++; throw new Error('The model must never decide real verification'); }
}
const terminal = {
  runCommand: async (command, options) => {
    shellCalls++;
    assert.equal(options.sandbox, 'require');
    assert.equal(options.runId, 'run_case');
    assert.equal(command, 'npm test');
    return { command, durationMs: 5, timedOut: false, stdout: '', stderr: '', ...sandboxResponse };
  },
  isEnvironmentOrSetupFailure: (stdout, stderr) => /SANDBOX-UNAVAILABLE|environment unavailable/i.test(`${stdout}\n${stderr}`),
};
const mockRequire = (id) => {
  if (id === 'fs') return fs;
  if (id === 'path') return path;
  if (id.includes('/agents/tester/tester')) return { TesterAgent: FakeTesterAgent };
  if (id.includes('/tools/terminal/index')) return terminal;
  throw new Error('Unexpected dependency ' + id);
};
const exportsObj = {};
new Function('require', 'module', 'exports', compiled.outputText)(mockRequire, { exports: exportsObj }, exportsObj);
const { createTesterNode } = exportsObj;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-verification-boundary-'));
fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ scripts: { test: 'node test.js' } }));
const state = { task: 'Fix the failing project test', workspace: tmp, runId: 'run_case', codeChanges: [] };
(async () => {
  const run = createTesterNode();
  const scenarios = [
    ['sandbox pass', { sandboxed: true, success: true, exitCode: 0 }, 'passed', true],
    ['sandbox assertion failure', { sandboxed: true, success: false, exitCode: 1, stderr: 'AssertionError' }, 'failed', false],
    ['sandbox unavailable', { sandboxed: false, success: false, exitCode: 1, blocked: true, stderr: '[SANDBOX-UNAVAILABLE] environment unavailable' }, 'environment_failure', false],
    ['host execution is not acceptable', { sandboxed: false, success: true, exitCode: 0 }, 'blocked', false],
    ['quota must not invalidate completed sandbox pass', { sandboxed: true, success: true, exitCode: 0 }, 'passed', true],
  ];
  for (const [name, response, expectedStatus, expectedPass] of scenarios) {
    sandboxResponse = response;
    const output = await run(state);
    assert.equal(output.testResults.verificationRecord.status, expectedStatus, name);
    assert.equal(output.testResults.passed, expectedPass, name);
    assert.equal(output.testResults.verificationRecord.exitCode, response.exitCode, name);
    assert.equal(output.testResults.verificationRecord.workspace, tmp, name);
    console.log('PASS', name);
  }
  assert.equal(shellCalls, scenarios.length);
  assert.equal(modelCalls, 0, 'No LLM should be invoked to decide a real test result');
  console.log(`CANONICAL VERIFICATION BOUNDARY: ${scenarios.length}/${scenarios.length} scenarios passed`);
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => fs.rmSync(tmp, { force: true, recursive: true }));
