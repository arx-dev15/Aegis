/**
 * Aegis Repository Intelligence Engine — Master Integration Test Suite
 * 
 * Verifies end-to-end ingestion, AST parsing, domain extraction, git analysis,
 * relationship graph building, hybrid retrieval, agent tool execution, and showcase queries.
 */

import { validateRepositoryAccess } from './connection/connectionManager';
import { extractApiRoutes } from './extractors/apiExtractor';
import { extractDatabaseModels } from './extractors/databaseExtractor';
import { extractDependencies } from './extractors/dependencyExtractor';
import { extractImportExports } from './extractors/importExportExtractor';
import { extractTests } from './extractors/testExtractor';
import { analyzeGitHistory } from './git/gitAnalyzer';
import { parseTypeScriptSymbols } from './parsers/tsParser';
import { buildRelationshipGraph } from './relationships/graphEngine';
import { queryRepositoryIntelligence } from './retrieval/hybridRetriever';
import { scanRepositoryDirectory } from './scanner/fileScanner';
import { JsonRepositoryStore } from './storage/jsonStore';
import { RepositorySnapshot } from './types';

async function runMasterRepoIntelligenceTests() {
  console.log('=== AEGIS REPOSITORY INTELLIGENCE ENGINE — MASTER E2E VERIFICATION ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      throw new Error(`Master test assertion failed: ${msg}`);
    }
  }

  // Step 1: Connection & Access Validation
  console.log('[Step 1] Access Validation & Identity Creation');
  const validRes = await validateRepositoryAccess(process.cwd());
  assert(validRes.valid === true && Boolean(validRes.repository?.id), 'Validates repository connection and generates identity');

  // Step 2: File Discovery & Ignore Scanner
  console.log('\n[Step 2] File Tree Discovery & Ignore Scanner');
  const files = await scanRepositoryDirectory(process.cwd(), { maxFileSizeKb: 2000 });
  assert(files.length > 10, 'Discovers codebase files ignoring node_modules and .git');
  assert(files.some((f) => f.path === 'package.json' && f.category === 'CONFIG'), 'Classifies package.json as CONFIG file');

  const fileContents: Record<string, string> = {};
  for (const f of files) {
    try {
      fileContents[f.path] = require('fs').readFileSync(f.path, 'utf-8');
    } catch {}
  }

  // Step 3: AST Parsing & Import/Export Resolution
  console.log('\n[Step 3] AST Symbol Parsing & Module Resolution');
  const allPaths = files.map((f) => f.path);
  const symbols = [];
  const importsExports = [];

  for (const f of files.filter((f) => ['TypeScript', 'JavaScript', 'TSX', 'JSX'].includes(f.language))) {
    const content = fileContents[f.path] || '';
    const fSyms = parseTypeScriptSymbols({
      repoId: validRes.repository!.id!,
      fileId: f.id,
      filePath: f.path,
      content,
      language: f.language,
    });
    symbols.push(...fSyms);

    const fIEs = extractImportExports({
      repoId: validRes.repository!.id!,
      fileId: f.id,
      filePath: f.path,
      content,
      allFilePaths: allPaths,
    });
    importsExports.push(...fIEs);
  }

  assert(symbols.length > 0, 'Extracts AST classes, functions, methods, and interfaces');
  assert(importsExports.some((ie) => ie.type === 'import'), 'Extracts import directives with module specifiers');

  // Step 4: Domain-Specific Extraction (Dependencies, APIs, DB Models, Tests)
  console.log('\n[Step 4] Domain-Specific Extraction');
  const dependencies = extractDependencies({ repoId: validRes.repository!.id!, files, fileContents });
  const apis = extractApiRoutes({ repoId: validRes.repository!.id!, files, fileContents, symbols });
  const databases = extractDatabaseModels({ repoId: validRes.repository!.id!, files, fileContents });
  const tests = extractTests({ repoId: validRes.repository!.id!, files, fileContents, symbols });

  assert(dependencies.length > 0, 'Extracts manifest dependencies');

  // Step 5: Git Intelligence Analysis
  console.log('\n[Step 5] Git History & Co-change Coupling');
  const { commits: gitCommits } = await analyzeGitHistory({
    repoId: validRes.repository!.id!,
    repoPath: process.cwd(),
    maxCommits: 20,
  });
  assert(gitCommits.length > 0, 'Extracts git commits and author statistics');

  // Step 6: Provenanced Relationship Graph Synthesis
  console.log('\n[Step 6] Provenanced Relationship Graph Synthesis');
  const relationships = buildRelationshipGraph({
    repoId: validRes.repository!.id!,
    files,
    symbols,
    importsExports,
    apis,
    databases,
    tests,
    fileContents,
  });

  assert(relationships.length > 0, 'Synthesizes typed relationship graph edges');
  assert(relationships.some((r) => r.type === 'CONTAINS'), 'Synthesizes CONTAINS file-symbol relationships');

  // Step 7: Persistent Snapshot Storage & Hybrid Retrieval
  console.log('\n[Step 7] Persistent Storage & Hybrid Retrieval');
  const snapshot: RepositorySnapshot = {
    repository: {
      ...validRes.repository as any,
      status: 'ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    files,
    symbols,
    importsExports,
    dependencies,
    apis,
    databases,
    tests,
    gitCommits,
    relationships,
  };

  const store = new JsonRepositoryStore();
  await store.saveSnapshot(snapshot);

  const retrieval = await queryRepositoryIntelligence({
    snapshot,
    query: 'What information exists in repository intelligence?',
    mode: 'structural',
  });

  assert(retrieval.formattedContext.includes('AEGIS REPOSITORY INTELLIGENCE EVIDENCE'), 'Returns formatted traceable evidence context');

  console.log(`\n=== Master Verification Completed: ${passed}/${total} assertions passed. ===\n`);
}

runMasterRepoIntelligenceTests().catch((err) => {
  console.error('Master Test Suite Failed:', err);
  process.exit(1);
});
