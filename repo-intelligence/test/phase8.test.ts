/**
 * Phase 8 Test Suite — Backend REST API & Showcase Query Flow Engines
 */

import { JsonRepositoryStore } from '../storage/jsonStore';
import { queryRepositoryIntelligence } from '../retrieval/hybridRetriever';
import { RepositorySnapshot } from '../types';

async function runPhase8Tests() {
  console.log('--- Aegis Repository Intelligence — Phase 8 Test Suite ---');
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

  const mockSnapshot: RepositorySnapshot = {
    repository: {
      id: 'repo_showcase_test',
      provider: 'local',
      owner: 'local',
      name: 'task-manager',
      url: 'd:/projects/task-manager',
      defaultBranch: 'main',
      analyzedRevision: 'a82f91c',
      commitSha: 'a82f91c',
      status: 'ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    files: [
      { id: 'f_auth_svc', repoId: 'repo_showcase_test', path: 'src/services/auth.service.ts', name: 'auth.service.ts', extension: '.ts', language: 'TypeScript', size: 1000, hash: 'h1', category: 'SOURCE', lines: 50, revision: 'main' },
      { id: 'f_proj_svc', repoId: 'repo_showcase_test', path: 'src/services/project.service.ts', name: 'project.service.ts', extension: '.ts', language: 'TypeScript', size: 1100, hash: 'h2', category: 'SOURCE', lines: 55, revision: 'main' },
      { id: 'f_user_svc', repoId: 'repo_showcase_test', path: 'src/services/user.service.ts', name: 'user.service.ts', extension: '.ts', language: 'TypeScript', size: 1200, hash: 'h3', category: 'SOURCE', lines: 60, revision: 'main' },
    ],
    symbols: [
      { id: 's_auth_svc', repoId: 'repo_showcase_test', fileId: 'f_auth_svc', filePath: 'src/services/auth.service.ts', name: 'AuthService', kind: 'class', startLine: 10, endLine: 50, exported: true, language: 'TypeScript' },
      { id: 's_proj_svc', repoId: 'repo_showcase_test', fileId: 'f_proj_svc', filePath: 'src/services/project.service.ts', name: 'ProjectService', kind: 'class', startLine: 10, endLine: 55, exported: true, language: 'TypeScript' },
      { id: 's_user_svc', repoId: 'repo_showcase_test', fileId: 'f_user_svc', filePath: 'src/services/user.service.ts', name: 'UserService', kind: 'class', startLine: 10, endLine: 60, exported: true, language: 'TypeScript' },
    ],
    importsExports: [],
    dependencies: [],
    apis: [
      { id: 'a_login', repoId: 'repo_showcase_test', fileId: 'f_auth_svc', filePath: 'src/routes/auth.routes.ts', method: 'POST', path: '/login', handlerName: 'AuthController.login', confidence: 'exact' },
      { id: 'a_proj', repoId: 'repo_showcase_test', fileId: 'f_proj_svc', filePath: 'src/routes/project.routes.ts', method: 'POST', path: '/projects', handlerName: 'ProjectController.create', confidence: 'exact' },
    ],
    databases: [
      { id: 'd_user', repoId: 'repo_showcase_test', fileId: 'f_auth_svc', filePath: 'src/services/auth.service.ts', technology: 'prisma', entityType: 'model', name: 'User' },
      { id: 'd_proj', repoId: 'repo_showcase_test', fileId: 'f_proj_svc', filePath: 'src/services/project.service.ts', technology: 'prisma', entityType: 'model', name: 'Project' },
    ],
    tests: [],
    gitCommits: [],
    relationships: [
      {
        id: 'r_user_dep',
        repoId: 'repo_showcase_test',
        sourceId: 's_auth_svc',
        sourceType: 'symbol',
        targetId: 's_user_svc',
        targetType: 'symbol',
        type: 'USES',
        provenance: { filePath: 'src/services/auth.service.ts', startLine: 15, reason: 'AuthService uses UserService for lookup' },
        confidence: 'exact',
      },
    ],
  };

  const store = new JsonRepositoryStore();
  await store.saveSnapshot(mockSnapshot);

  // Test 1: Showcase Query 1 — Authentication Tracing
  console.log('\n[1] Showcase Query 1 — Authentication Tracing');
  const show1 = await queryRepositoryIntelligence({
    snapshot: mockSnapshot,
    query: 'Where is authentication handled?',
    targetEntity: 'AuthService',
  });
  assert(show1.symbols.some((s) => s.name === 'AuthService'), 'Traces AuthService symbol definition');
  assert(show1.apis.some((a) => a.path === '/login'), 'Traces POST /login API endpoint');

  // Test 2: Showcase Query 2 — Project Creation Flow
  console.log('\n[2] Showcase Query 2 — Project Creation Flow');
  const show2 = await queryRepositoryIntelligence({
    snapshot: mockSnapshot,
    query: 'What happens when a user creates a project?',
    targetEntity: 'Project',
  });
  assert(show2.symbols.some((s) => s.name === 'ProjectService'), 'Traces ProjectService symbol definition');
  assert(show2.databases.some((d) => d.name === 'Project'), 'Traces Project database model');

  // Test 3: Showcase Query 3 — Impact Analysis
  console.log('\n[3] Showcase Query 3 — UserService Impact Analysis');
  const show3 = await queryRepositoryIntelligence({
    snapshot: mockSnapshot,
    query: 'If I change UserService, what could be affected?',
    targetEntity: 'UserService',
  });
  assert(show3.symbols.some((s) => s.name === 'UserService'), 'Identifies target symbol UserService');
  assert(show3.relationships.some((r) => r.targetId === 's_user_svc' && r.type === 'USES'), 'Traces dependent components calling UserService');

  console.log(`\nPhase 8 Test Results: ${passed}/${total} assertions passed.`);
}

runPhase8Tests().catch((err) => {
  console.error('Phase 8 Test Suite Failed:', err);
  process.exit(1);
});
