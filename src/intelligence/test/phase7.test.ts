/**
 * Phase 7 Test Suite — Hybrid Retrieval Engine & Agent Research Tools
 */

import { executeRepoExplorer } from '../../tools/repoIntelligence/repoExplorerTool';
import { queryRepositoryIntelligence } from '../retrieval/hybridRetriever';
import { JsonRepositoryStore } from '../storage/jsonStore';
import { RepositorySnapshot } from '../types';

async function runPhase7Tests() {
  console.log('--- Aegis Repository Intelligence — Phase 7 Test Suite ---');
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
      id: 'repo_hybrid_test',
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
      { id: 'f1', repoId: 'repo_hybrid_test', path: 'src/services/auth.service.ts', name: 'auth.service.ts', extension: '.ts', language: 'TypeScript', size: 1000, hash: 'h1', category: 'SOURCE', lines: 50, revision: 'main' },
    ],
    symbols: [
      { id: 's1', repoId: 'repo_hybrid_test', fileId: 'f1', filePath: 'src/services/auth.service.ts', name: 'AuthService', kind: 'class', startLine: 10, endLine: 50, exported: true, language: 'TypeScript' },
    ],
    importsExports: [],
    dependencies: [],
    apis: [
      { id: 'a1', repoId: 'repo_hybrid_test', fileId: 'f1', filePath: 'src/routes/auth.routes.ts', method: 'POST', path: '/login', handlerName: 'AuthController.login', confidence: 'exact' },
    ],
    databases: [
      { id: 'd1', repoId: 'repo_hybrid_test', fileId: 'f1', filePath: 'src/services/auth.service.ts', technology: 'prisma', entityType: 'model', name: 'User' },
    ],
    tests: [],
    gitCommits: [],
    relationships: [
      {
        id: 'r1',
        repoId: 'repo_hybrid_test',
        sourceId: 'a1',
        sourceType: 'api',
        targetId: 's1',
        targetType: 'symbol',
        type: 'HANDLES',
        provenance: { filePath: 'src/routes/auth.routes.ts', startLine: 12, reason: 'POST /login handled by AuthService.login' },
        confidence: 'exact',
      },
    ],
  };

  // Save to persistent JSON store for tool test
  const store = new JsonRepositoryStore();
  await store.saveSnapshot(mockSnapshot);

  // Test 1: Hybrid Retrieval Engine
  console.log('\n[1] Hybrid Retrieval Engine');
  const res = await queryRepositoryIntelligence({
    snapshot: mockSnapshot,
    query: 'authentication',
    mode: 'structural',
    targetEntity: 'AuthService',
  });

  assert(res.symbols.length === 1 && res.symbols[0].name === 'AuthService', 'Retrieves matched AST symbol AuthService');
  assert(res.apis.length === 1 && res.apis[0].path === '/login', 'Retrieves matched API route POST /login');
  assert(res.formattedContext.includes('AEGIS REPOSITORY INTELLIGENCE EVIDENCE'), 'Formats evidence header in Markdown context');
  assert(res.formattedContext.includes('AuthService') && res.formattedContext.includes('/login'), 'Includes line-level evidence references in Markdown context');

  // Test 2: Agent Tool Execution (repoExplorerTool)
  console.log('\n[2] Aegis Agent Tool Execution');
  const overviewResult = await executeRepoExplorer({
    repoId: 'repo_hybrid_test',
    query: 'overview',
    action: 'get_repository_overview',
  });
  assert(overviewResult.includes('task-manager') && overviewResult.includes('"totalFiles": 1'), 'Returns repository overview statistics JSON');

  const toolQueryResult = await executeRepoExplorer({
    repoId: 'repo_hybrid_test',
    query: 'Where is authentication handled?',
    targetEntity: 'AuthService',
  });
  assert(toolQueryResult.includes('AuthService') && toolQueryResult.includes('EVIDENCE'), 'Returns evidence-backed context output for agent calls');

  console.log(`\nPhase 7 Test Results: ${passed}/${total} assertions passed.`);
}

runPhase7Tests().catch((err) => {
  console.error('Phase 7 Test Suite Failed:', err);
  process.exit(1);
});
