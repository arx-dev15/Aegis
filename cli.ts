/**
 * Aegis Repository Intelligence — Interactive Command-Line Tool (CLI)
 * 
 * Usage:
 *   npx tsx cli.ts connect <url_or_path> [github_token]
 *   npx tsx cli.ts status <repoId>
 *   npx tsx cli.ts search <repoId> <query> [targetEntity]
 *   npx tsx cli.ts impact <repoId> <targetEntity>
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { validateRepositoryAccess, createRepositoryIdentity } from './repo-intelligence/connection/connectionManager';
import { ingestRemoteRepository } from './repo-intelligence/connection/remoteIngestion';
import { scanRepositoryDirectory } from './repo-intelligence/scanner/fileScanner';
import { parseTypeScriptSymbols } from './repo-intelligence/parsers/tsParser';
import { extractImportExports } from './repo-intelligence/extractors/importExportExtractor';
import { extractDependencies } from './repo-intelligence/extractors/dependencyExtractor';
import { extractApiRoutes } from './repo-intelligence/extractors/apiExtractor';
import { extractDatabaseModels } from './repo-intelligence/extractors/databaseExtractor';
import { extractTests } from './repo-intelligence/extractors/testExtractor';
import { analyzeGitHistory } from './repo-intelligence/git/gitAnalyzer';
import { buildRelationshipGraph } from './repo-intelligence/relationships/graphEngine';
import { JsonRepositoryStore } from './repo-intelligence/storage/jsonStore';
import { RepositorySnapshot } from './repo-intelligence/types';
import { queryRepositoryIntelligence, getRepositoryStatus } from './repo-intelligence/retrieval/hybridRetriever';

const store = new JsonRepositoryStore();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || ['--help', '-h'].includes(command)) {
    console.log(`
================================================================
  AEGIS REPOSITORY INTELLIGENCE — INTERACTIVE CLI
================================================================

COMMANDS:

  1. Connect & Ingest a Local or Remote GitHub Repository:
     npx tsx cli.ts connect <url_or_path>

     Note: GITHUB_TOKEN from your .env file is used automatically for private repos.

     Examples:
       npx tsx cli.ts connect .
       npx tsx cli.ts connect https://github.com/expressjs/express
       npx tsx cli.ts connect https://github.com/your-org/private-repo

  2. Check Repository Intelligence Status & Statistics:
     npx tsx cli.ts status <repoId>

     Example:
       npx tsx cli.ts status repo_aegis

  3. Query Codebase Intelligence:
     npx tsx cli.ts search <repoId> "<query>" [targetEntity]

     Example:
       npx tsx cli.ts search repo_aegis "Where is project creation handled?"

  4. Perform Impact Analysis:
     npx tsx cli.ts impact <repoId> <targetEntity>

     Example:
       npx tsx cli.ts impact repo_aegis PlannerAgent

================================================================
    `);
    return;
  }

  if (command === 'connect') {
    const rawUrl = args[1] || '.';
    // Automatically fallback to GITHUB_TOKEN in .env if token argument is omitted
    const token = args[2] || process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || process.env.GH_TOKEN;

    const targetPath = rawUrl === '.' ? process.cwd() : rawUrl;
    console.log(`\n🔍 Validating access for repository: "${targetPath}"...`);
    if (token) {
      console.log(`🔑 Using GitHub token from .env for authentication.`);
    }

    const validation = await validateRepositoryAccess(targetPath, { token });
    if (!validation.valid || !validation.repository) {
      console.error(`\n❌ Connection Failed: ${validation.error}`);
      process.exit(1);
    }

    let repoPath = targetPath;
    let cleanupRemote: (() => void) | undefined;

    const repoMeta = createRepositoryIdentity({
      provider: validation.repository.provider as any,
      owner: validation.repository.owner!,
      name: validation.repository.name!,
      url: validation.repository.url!,
      cleanUrl: validation.repository.url!,
    });

    if (validation.repository.provider === 'github') {
      console.log(`\n📥 Ingesting remote GitHub repository...`);
      const remoteRes = await ingestRemoteRepository({
        url: validation.repository.url,
        owner: validation.repository.owner,
        name: validation.repository.name,
        branch: validation.repository.defaultBranch,
        token,
      });
      repoPath = remoteRes.localPath;
      cleanupRemote = remoteRes.cleanup;
      if (remoteRes.commitSha && remoteRes.commitSha !== 'HEAD') {
        repoMeta.commitSha = remoteRes.commitSha;
        repoMeta.analyzedRevision = remoteRes.commitSha;
      }
    }

    console.log(`\n⚡ Scanning files and extracting AST symbols...`);
    const files = await scanRepositoryDirectory(repoPath, { repoId: repoMeta.id, revision: repoMeta.analyzedRevision });
    const fileContents: Record<string, string> = {};
    for (const f of files) {
      try { fileContents[f.path] = fs.readFileSync(path.resolve(repoPath, f.path), 'utf-8'); } catch {}
    }

    const allPaths = files.map((f) => f.path);
    const symbols = [];
    const importsExports = [];

    for (const f of files) {
      const content = fileContents[f.path] || '';
      if (['TypeScript', 'JavaScript', 'TSX', 'JSX'].includes(f.language)) {
        symbols.push(...parseTypeScriptSymbols({ repoId: repoMeta.id, fileId: f.id, filePath: f.path, content, language: f.language }));
        importsExports.push(...extractImportExports({ repoId: repoMeta.id, fileId: f.id, filePath: f.path, content, allFilePaths: allPaths }));
      }
    }

    const dependencies = extractDependencies({ repoId: repoMeta.id, files, fileContents });
    const apis = extractApiRoutes({ repoId: repoMeta.id, files, fileContents, symbols });
    const databases = extractDatabaseModels({ repoId: repoMeta.id, files, fileContents });
    const tests = extractTests({ repoId: repoMeta.id, files, fileContents, symbols });
    const { commits: gitCommits } = await analyzeGitHistory({ repoId: repoMeta.id, repoPath, maxCommits: 30 });

    const relationships = buildRelationshipGraph({
      repoId: repoMeta.id,
      files,
      symbols,
      importsExports,
      apis,
      databases,
      tests,
      fileContents,
    });

    repoMeta.status = 'ready';
    repoMeta.metadata = {
      analyzerVersion: 'Aegis Repository Intelligence v1',
      fileCount: files.length,
      sourceFileCount: files.filter((f) => f.category === 'SOURCE').length,
      symbolCount: symbols.length,
      relationshipCount: relationships.length,
      apiCount: apis.length,
      databaseModelCount: databases.length,
      testCount: tests.length,
      unsupportedLanguageCount: files.filter((f) => !['TypeScript', 'JavaScript', 'TSX', 'JSX'].includes(f.language)).length,
    };

    const snapshot: RepositorySnapshot = {
      repository: repoMeta,
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

    await store.saveSnapshot(snapshot);

    if (cleanupRemote) cleanupRemote();

    console.log(`\n================================================================`);
    console.log(` ✅ REPOSITORY CONNECTED & INDEXED SUCCESSFULLY!`);
    console.log(`================================================================`);
    console.log(`  Repository ID : ${repoMeta.id}`);
    console.log(`  Name          : ${repoMeta.owner}/${repoMeta.name}`);
    console.log(`  Provider      : ${repoMeta.provider}`);
    console.log(`  Files Found   : ${files.length}`);
    console.log(`  AST Symbols   : ${symbols.length}`);
    console.log(`  API Routes    : ${apis.length}`);
    console.log(`  DB Schemas    : ${databases.length}`);
    console.log(`  Graph Edges   : ${relationships.length}`);
    console.log(`================================================================\n`);
    console.log(`💡 Next Steps:`);
    console.log(`   npx tsx cli.ts status ${repoMeta.id}`);
    console.log(`   npx tsx cli.ts search ${repoMeta.id} "Where is authentication handled?"\n`);
    return;
  }

  if (command === 'status') {
    const repoId = args[1];
    if (!repoId) {
      console.log('Error: Please specify repoId. Example: npx tsx cli.ts status repo_local_local_aegis');
      return;
    }
    const snapshot = await store.getSnapshot(repoId);
    if (!snapshot) {
      console.log(`Error: Snapshot for repoId="${repoId}" not found. Run "npx tsx cli.ts connect <url>" first.`);
      return;
    }
    console.log(`\n${getRepositoryStatus(snapshot)}\n`);
    return;
  }

  if (command === 'search') {
    const repoId = args[1];
    const queryStr = args[2];
    const targetEntity = args[3];

    if (!repoId || !queryStr) {
      console.log('Error: Usage: npx tsx cli.ts search <repoId> "<query>" [targetEntity]');
      return;
    }

    const snapshot = await store.getSnapshot(repoId);
    if (!snapshot) {
      console.log(`Error: Snapshot for repoId="${repoId}" not found. Run "npx tsx cli.ts connect <url>" first.`);
      return;
    }

    const res = await queryRepositoryIntelligence({
      snapshot,
      query: queryStr,
      targetEntity,
    });

    console.log(`\n${res.formattedContext}\n`);
    return;
  }

  if (command === 'impact') {
    const repoId = args[1];
    const targetEntity = args[2];

    if (!repoId || !targetEntity) {
      console.log('Error: Usage: npx tsx cli.ts impact <repoId> <targetEntity>');
      return;
    }

    const snapshot = await store.getSnapshot(repoId);
    if (!snapshot) {
      console.log(`Error: Snapshot for repoId="${repoId}" not found. Run "npx tsx cli.ts connect <url>" first.`);
      return;
    }

    const res = await queryRepositoryIntelligence({
      snapshot,
      query: `If I change ${targetEntity}, what could be affected?`,
      targetEntity,
    });

    console.log(`\n${res.formattedContext}\n`);
    return;
  }

  console.log(`Unknown command "${command}". Run "npx tsx cli.ts --help" for options.`);
}

main().catch((err) => {
  console.error('CLI Error:', err);
  process.exit(1);
});
