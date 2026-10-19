/**
 * Phase 1 Test Suite — Repository Connection & Storage Layer
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createRepositoryIdentity,
  maskCredentials,
  parseRepositoryUrl,
  validateRepositoryAccess,
} from '../connection/connectionManager';
import { JsonRepositoryStore } from '../storage/jsonStore';
import { PgRepositoryStore } from '../storage/pgStore';
import { RepositorySnapshot } from '../types';

async function runPhase1Tests() {
  console.log('--- Aegis Repository Intelligence — Phase 1 Test Suite ---');
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

  // Test 1: URL Parsing
  console.log('\n[1] Repository URL Parsing');
  const ghHttp = parseRepositoryUrl('https://github.com/company/project.git');
  assert(ghHttp.provider === 'github' && ghHttp.owner === 'company' && ghHttp.name === 'project', 'Parses HTTPS GitHub URL');

  const ghSsh = parseRepositoryUrl('git@github.com:acme/task-manager.git');
  assert(ghSsh.provider === 'github' && ghSsh.owner === 'acme' && ghSsh.name === 'task-manager', 'Parses SSH GitHub URL');

  const localPath = parseRepositoryUrl(process.cwd());
  assert(localPath.provider === 'local' && localPath.name === path.basename(process.cwd()), 'Parses local directory path');

  // Test 2: Credential Masking
  console.log('\n[2] Credential Masking');
  const maskedToken = maskCredentials('Authorization: Bearer ghp_1234567890abcdefghijklmnopqrstuvwxyz');
  assert(!maskedToken.includes('ghp_1234567890'), 'Redacts GitHub personal access token');
  assert(maskedToken.includes('[REDACTED]') || maskedToken.includes('ghp_****'), 'Replaces token with redacted string');

  // Test 3: Local Repository Access Validation
  console.log('\n[3] Repository Connection Validation');
  const validLocal = await validateRepositoryAccess(process.cwd());
  assert(validLocal.valid === true && validLocal.repository?.name === path.basename(process.cwd()), 'Validates existing local repository');

  const invalidLocal = await validateRepositoryAccess(path.join(process.cwd(), 'non_existent_folder_xyz_123'));
  assert(invalidLocal.valid === false && Boolean(invalidLocal.error), 'Cleanly rejects non-existent repository path');

  // Test 4: Persistent JSON Repository Store
  console.log('\n[4] Persistent JSON Repository Store');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis_repo_test_'));
  try {
    const store = new JsonRepositoryStore(tempDir);

    const mockRepo = createRepositoryIdentity(parseRepositoryUrl('https://github.com/test/demo'), { branch: 'main' });
    mockRepo.status = 'ready';

    const mockSnapshot: RepositorySnapshot = {
      repository: mockRepo,
      files: [
        {
          id: 'file_1',
          repoId: mockRepo.id,
          path: 'src/services/auth.service.ts',
          name: 'auth.service.ts',
          extension: '.ts',
          language: 'TypeScript',
          size: 1200,
          hash: 'abc123hash',
          category: 'SOURCE',
          lines: 45,
          revision: 'main',
        },
      ],
      symbols: [
        {
          id: 'sym_1',
          repoId: mockRepo.id,
          fileId: 'file_1',
          filePath: 'src/services/auth.service.ts',
          name: 'AuthService',
          kind: 'class',
          startLine: 10,
          endLine: 45,
          exported: true,
          language: 'TypeScript',
        },
      ],
      importsExports: [],
      dependencies: [],
      apis: [],
      databases: [],
      tests: [],
      gitCommits: [],
      relationships: [
        {
          id: 'rel_1',
          repoId: mockRepo.id,
          sourceId: 'file_1',
          sourceType: 'file',
          targetId: 'sym_1',
          targetType: 'symbol',
          type: 'CONTAINS',
          provenance: { filePath: 'src/services/auth.service.ts', startLine: 10 },
          confidence: 'exact',
        },
      ],
    };

    await store.saveSnapshot(mockSnapshot);
    const retrieved = await store.getSnapshot(mockRepo.id);
    assert(retrieved !== null && retrieved.repository.id === mockRepo.id, 'Saves and retrieves full repository snapshot');
    assert(retrieved?.symbols.length === 1 && retrieved.symbols[0].name === 'AuthService', 'Preserves extracted symbol records');

    const symbolList = await store.findSymbols(mockRepo.id, { name: 'AuthService' });
    assert(symbolList.length === 1 && symbolList[0].kind === 'class', 'Finds symbols by filter criteria');

    const rels = await store.getRelationships(mockRepo.id, 'sym_1');
    assert(rels.length === 1 && rels[0].type === 'CONTAINS', 'Retrieves entity relationship graph records');

    const repos = await store.listRepositories();
    assert(repos.length === 1 && repos[0].name === 'demo', 'Lists indexed repositories');

    const deleted = await store.deleteSnapshot(mockRepo.id);
    assert(deleted === true && (await store.getSnapshot(mockRepo.id)) === null, 'Deletes snapshot cleanly');

    // Test 5: PostgreSQL Adapter Fallback
    console.log('\n[5] PostgreSQL Store Adapter');
    const pgStore = new PgRepositoryStore(tempDir);
    await pgStore.saveSnapshot(mockSnapshot);
    const pgRetrieved = await pgStore.getSnapshot(mockRepo.id);
    assert(pgRetrieved !== null && pgRetrieved.repository.name === 'demo', 'PgStore operates cleanly with JSON fallback');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(`\nPhase 1 Test Results: ${passed}/${total} assertions passed.`);
}

runPhase1Tests().catch((err) => {
  console.error('Phase 1 Test Suite Failed:', err);
  process.exit(1);
});
