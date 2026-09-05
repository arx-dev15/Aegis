/**
 * Phase 6 Test Suite — Provenanced Relationship Graph Engine & Incremental Re-analysis
 */

import { buildRelationshipGraph } from '../relationships/graphEngine';
import { ApiRecord, DatabaseRecord, FileRecord, ImportExportRecord, SymbolRecord, TestRecord } from '../types';

async function runPhase6Tests() {
  console.log('--- Aegis Repository Intelligence — Phase 6 Test Suite ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      throw new Error(`Test assertion failed: ${msg}`);
    }
  }

  const repoId = 'repo_graph_test';

  const mockFiles: FileRecord[] = [
    { id: 'f_ctrl', repoId, path: 'src/controllers/auth.controller.ts', name: 'auth.controller.ts', extension: '.ts', language: 'TypeScript', size: 1000, hash: 'h1', category: 'SOURCE', lines: 50, revision: 'main' },
    { id: 'f_svc', repoId, path: 'src/services/auth.service.ts', name: 'auth.service.ts', extension: '.ts', language: 'TypeScript', size: 1200, hash: 'h2', category: 'SOURCE', lines: 60, revision: 'main' },
    { id: 'f_test', repoId, path: 'tests/auth.service.test.ts', name: 'auth.service.test.ts', extension: '.ts', language: 'TypeScript', size: 800, hash: 'h3', category: 'TEST', lines: 40, revision: 'main' },
  ];

  const mockSymbols: SymbolRecord[] = [
    { id: 'sym_auth_ctrl', repoId, fileId: 'f_ctrl', filePath: 'src/controllers/auth.controller.ts', name: 'AuthController', kind: 'class', startLine: 10, endLine: 45, exported: true, language: 'TypeScript' },
    { id: 'sym_auth_svc', repoId, fileId: 'f_svc', filePath: 'src/services/auth.service.ts', name: 'AuthService', kind: 'class', startLine: 12, endLine: 55, exported: true, language: 'TypeScript' },
    { id: 'sym_login_method', repoId, fileId: 'f_svc', filePath: 'src/services/auth.service.ts', name: 'login', kind: 'method', startLine: 20, endLine: 35, parentSymbolId: 'sym_auth_svc', exported: true, language: 'TypeScript' },
  ];

  const mockImportsExports: ImportExportRecord[] = [
    { id: 'ie_1', repoId, fileId: 'f_ctrl', filePath: 'src/controllers/auth.controller.ts', type: 'import', moduleSpecifier: '../services/auth.service', resolvedFilePath: 'src/services/auth.service.ts', symbols: ['AuthService'], line: 3 },
  ];

  const mockApis: ApiRecord[] = [
    { id: 'api_1', repoId, fileId: 'f_ctrl', filePath: 'src/routes/auth.routes.ts', method: 'POST', path: '/login', handlerName: 'AuthController.login', handlerSymbolId: 'sym_auth_ctrl', confidence: 'exact' },
  ];

  const mockDatabases: DatabaseRecord[] = [
    { id: 'db_1', repoId, fileId: 'f_svc', filePath: 'src/services/auth.service.ts', technology: 'prisma', entityType: 'model', name: 'User' },
  ];

  const mockTests: TestRecord[] = [
    { id: 'test_1', repoId, fileId: 'f_test', filePath: 'tests/auth.service.test.ts', testName: 'AuthService', framework: 'Vitest', targetFilePaths: ['src/services/auth.service.ts'], targetSymbolIds: ['sym_auth_svc'] },
  ];

  const mockFileContents = {
    'src/controllers/auth.controller.ts': 'export class AuthController { private authService = new AuthService(); }',
    'src/services/auth.service.ts': 'export class AuthService { login() {} }',
    'tests/auth.service.test.ts': 'describe("AuthService", () => {});',
  };

  // Test 1: Relationship Graph Synthesizer
  console.log('\n[1] Provenanced Relationship Graph Engine');
  const rels = buildRelationshipGraph({
    repoId,
    files: mockFiles,
    symbols: mockSymbols,
    importsExports: mockImportsExports,
    apis: mockApis,
    databases: mockDatabases,
    tests: mockTests,
    fileContents: mockFileContents,
  });

  const containsRel = rels.find((r) => r.type === 'CONTAINS' && r.targetId === 'sym_auth_svc');
  assert(containsRel !== undefined && containsRel.sourceId === 'f_svc', 'Synthesizes CONTAINS relationship between File and Symbol');

  const importsRel = rels.find((r) => r.type === 'IMPORTS' && r.sourceId === 'f_ctrl' && r.targetId === 'f_svc');
  assert(importsRel !== undefined && importsRel.provenance.startLine === 3, 'Synthesizes IMPORTS relationship with line-level provenance');

  const handlesRel = rels.find((r) => r.type === 'HANDLES' && r.sourceId === 'api_1');
  assert(handlesRel !== undefined && handlesRel.targetId === 'sym_auth_ctrl', 'Synthesizes HANDLES relationship between API route and handler symbol');

  const testedByRel = rels.find((r) => r.type === 'TESTED_BY' && r.sourceId === 'f_svc');
  assert(testedByRel !== undefined && testedByRel.targetId === 'f_test', 'Synthesizes TESTED_BY relationship between Source File and Test Suite');

  const queriesRel = rels.find((r) => r.type === 'QUERIES' && r.sourceId === 'f_svc');
  assert(queriesRel !== undefined && queriesRel.targetId === 'db_1', 'Synthesizes QUERIES relationship between Service File and Database Model');

  const usesRel = rels.find((r) => r.type === 'USES' && r.sourceId === 'sym_auth_ctrl' && r.targetId === 'sym_auth_svc');
  assert(usesRel !== undefined && usesRel.confidence === 'inferred', 'Synthesizes USES relationship from AuthController to AuthService');

  console.log(`\nPhase 6 Test Results: ${passed}/${total} assertions passed.`);
}

runPhase6Tests().catch((err) => {
  console.error('Phase 6 Test Suite Failed:', err);
  process.exit(1);
});
