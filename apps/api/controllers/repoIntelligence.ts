/**
 * Aegis API Controller — Repository Intelligence Engine
 */

import { Request, Response } from 'express';
import path from 'path';
import {
  createRepositoryIdentity,
  validateRepositoryAccess,
} from '../../repo-intelligence/connection/connectionManager';
import { ingestRemoteRepository } from '../../repo-intelligence/connection/remoteIngestion';
import { extractApiRoutes } from '../../repo-intelligence/extractors/apiExtractor';
import { extractDatabaseModels } from '../../repo-intelligence/extractors/databaseExtractor';
import { extractDependencies } from '../../repo-intelligence/extractors/dependencyExtractor';
import { extractImportExports } from '../../repo-intelligence/extractors/importExportExtractor';
import { extractTests } from '../../repo-intelligence/extractors/testExtractor';
import { analyzeGitHistory } from '../../repo-intelligence/git/gitAnalyzer';
import { parseTypeScriptSymbols } from '../../repo-intelligence/parsers/tsParser';
import { buildRelationshipGraph } from '../../repo-intelligence/relationships/graphEngine';
import { getRepositoryStatus, queryRepositoryIntelligence } from '../../repo-intelligence/retrieval/hybridRetriever';
import { scanRepositoryDirectory } from '../../repo-intelligence/scanner/fileScanner';
import { JsonRepositoryStore } from '../../repo-intelligence/storage/jsonStore';
import { RepositorySnapshot } from '../../repo-intelligence/types';

const store = new JsonRepositoryStore();

export async function connectRepository(req: Request, res: Response) {
  let cleanupRemote: (() => void) | undefined;

  try {
    const { url, branch, commitSha, token } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Repository URL or path is required.' });
    }

    const authToken = token || process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || process.env.GH_TOKEN;

    // 1. Validate connection
    const validation = await validateRepositoryAccess(url, { branch, commitSha, token: authToken });
    if (!validation.valid || !validation.repository) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'Repository connection validation failed.',
      });
    }

    const repoMetadata = createRepositoryIdentity(
      { provider: validation.repository.provider as any, owner: validation.repository.owner!, name: validation.repository.name!, url: validation.repository.url!, cleanUrl: validation.repository.url! },
      { branch, commitSha }
    );
    repoMetadata.status = 'analyzing';

    let repoPath: string;
    if (validation.repository.provider === 'local') {
      repoPath = url;
    } else if (validation.repository.provider === 'github') {
      const remoteRes = await ingestRemoteRepository({
        url: validation.repository.url,
        owner: validation.repository.owner,
        name: validation.repository.name,
        branch: validation.repository.defaultBranch,
        commitSha,
        token: authToken,
      });
      repoPath = remoteRes.localPath;
      cleanupRemote = remoteRes.cleanup;
      if (remoteRes.commitSha && remoteRes.commitSha !== 'HEAD') {
        repoMetadata.commitSha = remoteRes.commitSha;
        repoMetadata.analyzedRevision = remoteRes.commitSha;
      }
    } else {
      return res.status(400).json({ error: `Unsupported repository provider for "${url}".` });
    }

    // 2. Perform static repository ingestion & AST extraction
    const files = await scanRepositoryDirectory(repoPath, { repoId: repoMetadata.id, revision: repoMetadata.analyzedRevision });
    const fileContents: Record<string, string> = {};
    for (const f of files) {
      try {
        fileContents[f.path] = require('fs').readFileSync(path.resolve(repoPath, f.path), 'utf-8');
      } catch {}
    }

    const allFilePaths = files.map((f) => f.path);
    const symbols = [];
    const importsExports = [];

    for (const f of files) {
      const content = fileContents[f.path] || '';
      if (['TypeScript', 'JavaScript', 'TSX', 'JSX'].includes(f.language)) {
        const fSyms = parseTypeScriptSymbols({
          repoId: repoMetadata.id,
          fileId: f.id,
          filePath: f.path,
          content,
          language: f.language,
        });
        symbols.push(...fSyms);

        const fIEs = extractImportExports({
          repoId: repoMetadata.id,
          fileId: f.id,
          filePath: f.path,
          content,
          allFilePaths,
        });
        importsExports.push(...fIEs);
      }
    }

    const dependencies = extractDependencies({ repoId: repoMetadata.id, files, fileContents });
    const apis = extractApiRoutes({ repoId: repoMetadata.id, files, fileContents, symbols });
    const databases = extractDatabaseModels({ repoId: repoMetadata.id, files, fileContents });
    const tests = extractTests({ repoId: repoMetadata.id, files, fileContents, symbols });
    const { commits: gitCommits } = await analyzeGitHistory({ repoId: repoMetadata.id, repoPath, maxCommits: 30 });

    const relationships = buildRelationshipGraph({
      repoId: repoMetadata.id,
      files,
      symbols,
      importsExports,
      apis,
      databases,
      tests,
      fileContents,
    });

    repoMetadata.status = 'ready';
    repoMetadata.metadata = {
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
      repository: repoMetadata,
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

    return res.status(200).json({
      success: true,
      repository: repoMetadata,
      summary: repoMetadata.metadata,
    });
  } catch (err: any) {
    if (cleanupRemote) cleanupRemote();
    return res.status(500).json({ error: `Repository ingestion failed: ${err.message}` });
  }
}

export async function getRepositorySnapshot(req: Request, res: Response) {
  const { repoId } = req.params;
  const snapshot = await store.getSnapshot(repoId);
  if (!snapshot) {
    return res.status(404).json({ error: `Repository snapshot "${repoId}" not found.` });
  }
  return res.status(200).json(snapshot);
}

export async function getRepositoryStatusHandler(req: Request, res: Response) {
  const { repoId } = req.params;
  const snapshot = await store.getSnapshot(repoId);
  if (!snapshot) {
    return res.status(404).json({ error: `Repository snapshot "${repoId}" not found.` });
  }
  const statusText = getRepositoryStatus(snapshot);
  return res.status(200).json({
    repoId,
    repository: snapshot.repository,
    statusText,
    summary: snapshot.repository.metadata,
  });
}

export async function listRepositories(_req: Request, res: Response) {
  const repos = await store.listRepositories();
  return res.status(200).json(repos);
}

export async function searchRepositoryIntelligence(req: Request, res: Response) {
  const { repoId } = req.params;
  const { query, mode, targetEntity } = req.query;

  const snapshot = await store.getSnapshot(repoId);
  if (!snapshot) {
    return res.status(404).json({ error: `Repository snapshot "${repoId}" not found.` });
  }

  const result = await queryRepositoryIntelligence({
    snapshot,
    query: String(query || ''),
    mode: (mode as any) || 'hybrid',
    targetEntity: targetEntity ? String(targetEntity) : undefined,
  });

  return res.status(200).json(result);
}

export async function executeShowcaseQuery(req: Request, res: Response) {
  const { repoId } = req.params;
  const { showcaseId } = req.body;

  const snapshot = await store.getSnapshot(repoId);
  if (!snapshot) {
    return res.status(404).json({ error: `Repository snapshot "${repoId}" not found.` });
  }

  if (showcaseId === 1 || showcaseId === 'auth') {
    const result = await queryRepositoryIntelligence({
      snapshot,
      query: 'Where is authentication handled?',
      targetEntity: 'auth',
    });
    const flowText = result.impactReport?.flowSteps?.length
      ? result.impactReport.flowSteps.map((s) => `${s.entity} (${s.type})`).join(' → ')
      : 'No dynamic execution flow steps found for authentication query.';

    return res.status(200).json({
      showcaseId: 1,
      title: 'Showcase 1: Authentication Tracing',
      flowDiagram: flowText,
      result,
    });
  }

  if (showcaseId === 2 || showcaseId === 'create_project') {
    const result = await queryRepositoryIntelligence({
      snapshot,
      query: 'What happens when a user creates a project?',
      targetEntity: 'project',
    });
    const flowText = result.impactReport?.flowSteps?.length
      ? result.impactReport.flowSteps.map((s) => `${s.entity} (${s.type})`).join(' → ')
      : 'No dynamic execution flow steps found for project creation query.';

    return res.status(200).json({
      showcaseId: 2,
      title: 'Showcase 2: Project Creation Flow',
      flowDiagram: flowText,
      result,
    });
  }

  if (showcaseId === 3 || showcaseId === 'impact') {
    const result = await queryRepositoryIntelligence({
      snapshot,
      query: 'If I change UserService, what could be affected?',
      targetEntity: 'UserService',
    });
    const flowText = result.impactReport?.flowSteps?.length
      ? result.impactReport.flowSteps.map((s) => `${s.entity} (${s.type})`).join(' → ')
      : 'Target entity not found or no dependent components identified.';

    return res.status(200).json({
      showcaseId: 3,
      title: 'Showcase 3: UserService Impact Analysis',
      flowDiagram: flowText,
      result,
    });
  }

  return res.status(400).json({ error: 'Invalid showcaseId specified. Choose 1, 2, or 3.' });
}
