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
import { executeApprovalWorkflow, resolveApprovalAndResume } from './graph/approvalWorkflow.js';

const store = new JsonRepositoryStore();

export function resolveTargetWorkspace(taskInput: string, defaultCwd: string): string {
  const normalizedTask = taskInput.toLowerCase();

  // 1. Explicit path in taskInput (e.g. "in d:\foo\bar" or "in ./bar")
  const pathMatch = taskInput.match(/(?:in|at|workspace|folder|dir|directory)\s+["']?([a-zA-Z]:\\[^"'\s]+|\/[^"'\s]+|\.[/\\][^"'\s]+)["']?/i);
  if (pathMatch && fs.existsSync(pathMatch[1])) {
    try {
      const stat = fs.statSync(pathMatch[1]);
      if (stat.isDirectory()) {
        return path.resolve(pathMatch[1]);
      }
    } catch {}
  }

  // 2. Search bases (defaultCwd, parent directory, grandparent directory)
  const searchBases = [
    defaultCwd,
    path.dirname(defaultCwd),
    path.dirname(path.dirname(defaultCwd)),
  ];

  const normTaskAlphaOnly = normalizedTask.replace(/[^a-z0-9]/g, '');

  for (const baseDir of searchBases) {
    if (!fs.existsSync(baseDir)) continue;
    try {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const folderName = entry.name;
        if (folderName === 'node_modules' || folderName.startsWith('.')) continue;

        const normFolder = folderName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normFolder.length < 3) continue;

        // If folder name matches task input text directly
        if (normTaskAlphaOnly.includes(normFolder)) {
          return path.join(baseDir, folderName);
        }

        // Alias match for "blog app" / "blog website" -> "Blog_Website" / "Blog Website"
        if (
          (normalizedTask.includes('blog app') ||
            normalizedTask.includes('blog-app') ||
            normalizedTask.includes('blog_app') ||
            normalizedTask.includes('blog website') ||
            normalizedTask.includes('blog_website')) &&
          normFolder.includes('blog')
        ) {
          return path.join(baseDir, folderName);
        }
      }
    } catch {}
  }

  return defaultCwd;
}

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

    if (command === 'run') {
      const runArgs = args.slice(1);
      const wsFlagIdx = runArgs.indexOf('--workspace');
      let workspaceOverride: string | undefined;
      let filteredTaskArgs = runArgs;

      if (wsFlagIdx !== -1 && runArgs[wsFlagIdx + 1]) {
        workspaceOverride = runArgs[wsFlagIdx + 1];
        filteredTaskArgs = runArgs.slice(0, wsFlagIdx).concat(runArgs.slice(wsFlagIdx + 2));
      }

      let executionMode: 'automatic' | 'semi-auto' | 'manual' = 'semi-auto';
      const modeFlagIdx = filteredTaskArgs.findIndex((a) => a === '--mode' || a === '--execution-mode');
      if (modeFlagIdx !== -1 && filteredTaskArgs[modeFlagIdx + 1]) {
        const parsedMode = filteredTaskArgs[modeFlagIdx + 1].toLowerCase();
        if (parsedMode === 'automatic' || parsedMode === 'semi-auto' || parsedMode === 'manual') {
          executionMode = parsedMode;
        }
        filteredTaskArgs = filteredTaskArgs.slice(0, modeFlagIdx).concat(filteredTaskArgs.slice(modeFlagIdx + 2));
      }

      const taskInput = filteredTaskArgs.join(' ');
      if (!taskInput) {
        console.log('Error: Usage: npx tsx cli.ts run "<task_description>" [--workspace <path>] [--mode <automatic|semi-auto|manual>]');
        return;
      }

      const runId = `run_${Date.now()}`;
      const defaultCwd = process.cwd();
      const workspace = workspaceOverride
        ? path.resolve(workspaceOverride)
        : resolveTargetWorkspace(taskInput, defaultCwd);

      console.log(`\n🚀 Starting Aegis Engineering Task Workflow...`);
      console.log(`  Task      : "${taskInput}"`);
      console.log(`  Workspace : ${workspace}`);
      console.log(`  Mode      : ${executionMode}`);
      console.log(`  Run ID    : ${runId}\n`);

      const initialState = {
        task: taskInput,
        workspace: workspace,
        executionMode: executionMode,
      };

      const finalState = await executeApprovalWorkflow(runId, initialState);

      if (finalState.status === 'paused' && finalState.pendingApproval) {
        console.log(`\n================================================================`);
        console.log(` ⏸️  WORKFLOW PAUSED — HUMAN APPROVAL REQUIRED`);
        console.log(`================================================================`);
        console.log(`  Run ID      : ${runId}`);
        console.log(`  Approval ID : ${finalState.pendingApproval.id}`);
        console.log(`  Action      : ${finalState.pendingApproval.action}`);
        console.log(`  Target      : ${finalState.pendingApproval.target}`);
        console.log(`  Reason      : ${finalState.pendingApproval.description}`);
        console.log(`================================================================`);
        console.log(`💡 To approve and execute, run:`);
        console.log(`   npx tsx cli.ts approve ${runId} ${finalState.pendingApproval.id} approve\n`);
        return;
      }

      console.log(`\n================================================================`);
      console.log(` ✅ WORKFLOW COMPLETED SUCCESSFULLY!`);
      console.log(`================================================================`);
      console.log(`  Status       : ${finalState.status}`);
      console.log(`  Code Changes : ${finalState.codeChanges?.length || 0} file(s)`);
      if (finalState.testResults) {
        console.log(`  Test Status  : ${finalState.testResults.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
        console.log(`  Test Summary : ${finalState.testResults.output}`);
      }
      if (finalState.executionLog?.length) {
        console.log(`  Execution Log:`);
        finalState.executionLog.forEach((l) => console.log(`    - ${l}`));
      }
      console.log(`================================================================\n`);
      return;
    }

    if (command === 'approve') {
      const runId = args[1];
      const approvalId = args[2];
      const decisionArg = (args[3] || 'approve') as 'approve' | 'reject';

      if (!runId || !approvalId) {
        console.log('Error: Usage: npx tsx cli.ts approve <runId> <approvalId> [approve|reject]');
        return;
      }

      console.log(`\n🔄 Resuming Aegis Workflow for Run "${runId}" with decision "${decisionArg}"...`);
      const finalState = await resolveApprovalAndResume(runId, approvalId, decisionArg);

      console.log(`\n================================================================`);
      console.log(` ✅ WORKFLOW RESUMED AND EXECUTED!`);
      console.log(`================================================================`);
      console.log(`  Status       : ${finalState.status}`);
      console.log(`  Execution Log:`);
      finalState.executionLog?.forEach((l) => console.log(`    - ${l}`));
      console.log(`================================================================\n`);
      return;
    }

  console.log(`Unknown command "${command}". Run "npx tsx cli.ts --help" for options.`);
}

main().catch((err) => {
  console.error('CLI Error:', err);
  process.exit(1);
});
