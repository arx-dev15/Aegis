/**
 * Phase 4 Test Suite — Domain Extractors (Dependencies, APIs, DB Models, Tests)
 */

import { extractApiRoutes } from '../extractors/apiExtractor';
import { extractDatabaseModels } from '../extractors/databaseExtractor';
import { extractDependencies } from '../extractors/dependencyExtractor';
import { extractTests } from '../extractors/testExtractor';
import { FileRecord, SymbolRecord } from '../types';

async function runPhase4Tests() {
  console.log('--- Aegis Repository Intelligence — Phase 4 Test Suite ---');
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

  // Test 1: Dependency Extractor & Monorepo Support
  console.log('\n[1] Dependency & Monorepo Extractor');
  const mockFiles: FileRecord[] = [
    { id: 'f_pkg', repoId: 'repo_test', path: 'package.json', name: 'package.json', extension: '.json', language: 'JSON', size: 500, hash: 'h1', category: 'CONFIG', lines: 20, revision: 'main' },
    { id: 'f_api_pkg', repoId: 'repo_test', path: 'apps/api/package.json', name: 'package.json', extension: '.json', language: 'JSON', size: 400, hash: 'h2', category: 'CONFIG', lines: 15, revision: 'main' },
  ];
  const fileContents = {
    'package.json': JSON.stringify({ name: 'root', dependencies: { express: '^4.19.0' }, devDependencies: { typescript: '^5.5.0' } }),
    'apps/api/package.json': JSON.stringify({ name: '@app/api', dependencies: { express: '^4.19.0', jsonwebtoken: '^9.0.0' } }),
  };

  const deps = extractDependencies({ repoId: 'repo_test', files: mockFiles, fileContents });
  assert(deps.some((d) => d.name === 'express' && d.type === 'runtime'), 'Extracts runtime dependency express');
  assert(deps.some((d) => d.name === 'typescript' && d.type === 'dev'), 'Extracts dev dependency typescript');

  // Test 2: API Route Extractor
  console.log('\n[2] API Route Extractor');
  const apiFiles: FileRecord[] = [
    { id: 'f_routes', repoId: 'repo_test', path: 'src/routes/auth.routes.ts', name: 'auth.routes.ts', extension: '.ts', language: 'TypeScript', size: 600, hash: 'h3', category: 'SOURCE', lines: 30, revision: 'main' },
  ];
  const apiContents = {
    'src/routes/auth.routes.ts': `
      import { authController } from '../controllers/auth.controller';
      router.post('/login', authController.login);
      router.get('/me', authController.getProfile);
    `,
  };
  const mockSymbols: SymbolRecord[] = [
    { id: 'sym_auth_login', repoId: 'repo_test', fileId: 'f_auth_ctrl', filePath: 'src/controllers/auth.controller.ts', name: 'login', kind: 'method', startLine: 12, endLine: 40, exported: true, language: 'TypeScript' },
  ];

  const apiRoutes = extractApiRoutes({ repoId: 'repo_test', files: apiFiles, fileContents: apiContents, symbols: mockSymbols });
  const postLogin = apiRoutes.find((a) => a.path === '/login');
  assert(postLogin !== undefined && postLogin.method === 'POST', 'Extracts POST /login API endpoint');
  assert(postLogin?.handlerName === 'authController.login', 'Extracts API handler function reference');

  // Test 3: Database Model Extractor
  console.log('\n[3] Database Model Extractor');
  const dbFiles: FileRecord[] = [
    { id: 'f_schema', repoId: 'repo_test', path: 'prisma/schema.prisma', name: 'schema.prisma', extension: '.prisma', language: 'Schema', size: 800, hash: 'h4', category: 'SCHEMA', lines: 40, revision: 'main' },
    { id: 'f_repo', repoId: 'repo_test', path: 'src/repositories/user.repository.ts', name: 'user.repository.ts', extension: '.ts', language: 'TypeScript', size: 900, hash: 'h5', category: 'SOURCE', lines: 50, revision: 'main' },
  ];
  const dbContents = {
    'prisma/schema.prisma': `
      model User {
        id Int @id
        email String
        projects Project[]
      }
      model Project {
        id Int @id
        name String
      }
    `,
    'src/repositories/user.repository.ts': `
      async function findUser() {
        return db.query("SELECT * FROM users WHERE id = $1");
      }
    `,
  };

  const dbModels = extractDatabaseModels({ repoId: 'repo_test', files: dbFiles, fileContents: dbContents });
  assert(dbModels.some((m) => m.name === 'User' && m.technology === 'prisma'), 'Extracts Prisma User model');
  assert(dbModels.some((m) => m.name === 'Project' && m.technology === 'prisma'), 'Extracts Prisma Project model');
  assert(dbModels.some((m) => m.name === 'users' && m.technology === 'sql'), 'Extracts direct SQL table usage from queries');

  // Test 4: Test Intelligence Extractor
  console.log('\n[4] Test Intelligence Extractor');
  const testFiles: FileRecord[] = [
    { id: 'f_test', repoId: 'repo_test', path: 'tests/auth.service.test.ts', name: 'auth.service.test.ts', extension: '.ts', language: 'TypeScript', size: 700, hash: 'h6', category: 'TEST', lines: 35, revision: 'main' },
  ];
  const testContents = {
    'tests/auth.service.test.ts': `
      describe("AuthService", () => {
        it("should authenticate valid user credentials", () => {});
      });
    `,
  };

  const testRecords = extractTests({ repoId: 'repo_test', files: testFiles, fileContents: testContents, symbols: mockSymbols });
  assert(testRecords.length > 0 && testRecords[0].testName === 'AuthService', 'Extracts AuthService test suite describe block');

  console.log(`\nPhase 4 Test Results: ${passed}/${total} assertions passed.`);
}

runPhase4Tests().catch((err) => {
  console.error('Phase 4 Test Suite Failed:', err);
  process.exit(1);
});
