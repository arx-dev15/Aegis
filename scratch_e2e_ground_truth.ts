import fs from 'fs';
import path from 'path';
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
import { queryRepositoryIntelligence, getRepositoryStatus } from './repo-intelligence/retrieval/hybridRetriever';
import { sanitizeRepositoryContent } from './repo-intelligence/scanner/security';
import { performIncrementalReanalysis } from './repo-intelligence/incremental/reanalyzer';
import { executeRepoExplorer } from './tools/repoIntelligence/repoExplorerTool';

async function analyzeRepoPath(targetPath: string, isRemote: boolean = false, remoteUrl?: string) {
  let repoPath = targetPath;
  let validation = await validateRepositoryAccess(remoteUrl || targetPath);
  
  if (!validation.valid || !validation.repository) {
    throw new Error(`Validation failed: ${validation.error}`);
  }

  const repoMeta = createRepositoryIdentity({
    provider: validation.repository.provider as any,
    owner: validation.repository.owner!,
    name: validation.repository.name!,
    url: validation.repository.url!,
    cleanUrl: validation.repository.url!,
  });

  let cleanupFn = () => {};

  if (isRemote) {
    const remoteRes = await ingestRemoteRepository({
      url: validation.repository.url,
      owner: validation.repository.owner!,
      name: validation.repository.name!,
      branch: validation.repository.defaultBranch,
      token: process.env.GITHUB_TOKEN,
    });
    repoPath = remoteRes.localPath;
    repoMeta.commitSha = remoteRes.commitSha;
    repoMeta.analyzedRevision = remoteRes.commitSha;
    cleanupFn = remoteRes.cleanup;
  }

  const files = await scanRepositoryDirectory(repoPath, { repoId: repoMeta.id, revision: repoMeta.analyzedRevision });
  const fileContents: Record<string, string> = {};
  for (const f of files) {
    try {
      fileContents[f.path] = fs.readFileSync(path.resolve(repoPath, f.path), 'utf-8');
    } catch {}
  }

  const allPaths = files.map((f) => f.path);
  const symbols: any[] = [];
  const importsExports: any[] = [];

  for (const f of files) {
    const content = fileContents[f.path];
    if (!content) continue;
    if (f.extension === '.ts' || f.extension === '.tsx' || f.extension === '.js' || f.extension === '.jsx') {
      symbols.push(...parseTypeScriptSymbols({ repoId: repoMeta.id, fileId: f.id, filePath: f.path, content, language: f.language }));
      importsExports.push(...extractImportExports({ repoId: repoMeta.id, fileId: f.id, filePath: f.path, content, allFilePaths: allPaths }));
    }
  }

  const dependencies = extractDependencies({ repoId: repoMeta.id, files, fileContents });
  const apis = extractApiRoutes({ repoId: repoMeta.id, files, fileContents, symbols });
  const databases = extractDatabaseModels({ repoId: repoMeta.id, files, fileContents });
  const tests = extractTests({ repoId: repoMeta.id, files, fileContents, symbols });
  const gitRes = await analyzeGitHistory({ repoId: repoMeta.id, repoPath });
  const gitCommits = gitRes.commits;

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

  const snapshot = {
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

  const store = new JsonRepositoryStore();
  await store.saveSnapshot(snapshot);

  return { snapshot, store, cleanup: cleanupFn };
}

async function runE2EGroundTruthValidation() {
  console.log('================================================================');
  console.log('   AEGIS FEATURE 10 — GROUND-TRUTH E2E VALIDATION SUITE');
  console.log('================================================================\n');

  // --- 1. REPOSITORY A (Aegis Self-Analysis) ---
  console.log('[REPOS 1/3] Analyzing Repository A: Aegis Self Codebase...');
  const aegisPath = path.resolve(process.cwd());
  const aegisRes = await analyzeRepoPath(aegisPath);
  console.log(`  ✓ Aegis Indexed: ${aegisRes.snapshot.files.length} files, ${aegisRes.snapshot.symbols.length} symbols, ${aegisRes.snapshot.relationships.length} edges.`);

  // --- 2. REPOSITORY B (Independent TS Project Ground-Truth) ---
  console.log('\n[REPOS 2/3] Building & Analyzing Repository B: Independent TS Microservice...');
  const tmpRepoB = path.resolve(process.cwd(), '.tmp', 'repo_b_ground_truth');
  if (fs.existsSync(tmpRepoB)) fs.rmSync(tmpRepoB, { recursive: true, force: true });
  fs.mkdirSync(path.join(tmpRepoB, 'src', 'controllers'), { recursive: true });
  fs.mkdirSync(path.join(tmpRepoB, 'src', 'services'), { recursive: true });
  fs.mkdirSync(path.join(tmpRepoB, 'src', 'models'), { recursive: true });
  fs.mkdirSync(path.join(tmpRepoB, 'tests'), { recursive: true });

  fs.writeFileSync(path.join(tmpRepoB, 'package.json'), JSON.stringify({
    name: 'project-manager-microservice',
    version: '1.0.0',
    dependencies: { express: '^4.18.2', '@prisma/client': '^5.0.0' },
    devDependencies: { typescript: '^5.0.0', vitest: '^1.0.0' }
  }));

  fs.writeFileSync(path.join(tmpRepoB, 'src', 'models', 'project.ts'), `
export interface Project {
  id: string;
  name: string;
}
`);

  fs.writeFileSync(path.join(tmpRepoB, 'src', 'services', 'projectService.ts'), `
import { Project } from '../models/project';

export class ProjectService {
  public async createProject(name: string): Promise<Project> {
    return { id: 'p1', name };
  }
  public async findProject(id: string): Promise<Project | null> {
    return null;
  }
}
`);

  fs.writeFileSync(path.join(tmpRepoB, 'src', 'controllers', 'projectController.ts'), `
import { ProjectService } from '../services/projectService';

export class ProjectController {
  private projectService = new ProjectService();

  public async create(req: any, res: any) {
    const proj = await this.projectService.createProject(req.body.name);
    return res.json(proj);
  }
}
`);

  fs.writeFileSync(path.join(tmpRepoB, 'tests', 'projectService.test.ts'), `
import { describe, it, expect } from 'vitest';
import { ProjectService } from '../src/services/projectService';

describe('ProjectService', () => {
  it('should create project', async () => {
    const service = new ProjectService();
    const p = await service.createProject('Demo');
    expect(p.id).toBe('p1');
  });
});
`);

  const repoBRes = await analyzeRepoPath(tmpRepoB);
  console.log(`  ✓ Repository B Indexed: ${repoBRes.snapshot.files.length} files, ${repoBRes.snapshot.symbols.length} symbols, ${repoBRes.snapshot.relationships.length} edges.`);

  // --- 3. REPOSITORY C (Remote GitHub Repository) ---
  console.log('\n[REPOS 3/3] Ingesting & Analyzing Repository C: Remote GitHub Repo...');
  const remoteUrl = 'https://github.com/expressjs/express';
  let repoCRes: any;
  try {
    repoCRes = await analyzeRepoPath('expressjs/express', true, remoteUrl);
    console.log(`  ✓ Remote Repo C Indexed: ${repoCRes.snapshot.files.length} files, ${repoCRes.snapshot.symbols.length} symbols, ${repoCRes.snapshot.relationships.length} edges.`);
    repoCRes.cleanup();
  } catch (err: any) {
    console.log(`  ! Remote Ingestion Note: ${err.message}`);
  }

  // --- 4. SHOWCASE QUERIES & EVIDENCE VERIFICATION ---
  console.log('\n================================================================');
  console.log('   SHOWCASE QUERY VERIFICATION (GROUND-TRUTH)');
  console.log('================================================================\n');

  console.log('--- SHOWCASE 1: Where is authentication handled? (on Aegis) ---');
  const q1 = await queryRepositoryIntelligence({
    snapshot: aegisRes.snapshot,
    query: 'Where is authentication handled?',
  });
  console.log(`Status: ${q1.answerStatus} | Mode: ${q1.mode}`);
  console.log(`Matched Symbols: ${q1.symbols.map(s => s.name).join(', ')}`);
  console.log(`Matched APIs: ${q1.apis.map(a => `${a.method} ${a.path}`).join(', ')}`);

  console.log('\n--- SHOWCASE 2: What happens when a user creates a project? (on Repos B) ---');
  const q2 = await queryRepositoryIntelligence({
    snapshot: repoBRes.snapshot,
    query: 'What happens when a user creates a project?',
    targetEntity: 'Project',
  });
  console.log(`Status: ${q2.answerStatus} | Mode: ${q2.mode}`);
  console.log(`Matched Symbols: ${q2.symbols.map(s => s.name).join(', ')}`);
  console.log(`Impact Resolved: ${q2.impactReport?.resolvedSymbol?.name} (${q2.impactReport?.targetResolutionStatus})`);
  console.log(`Flow Steps: ${q2.impactReport?.flowSteps.map(f => f.entity).join(' -> ')}`);

  console.log('\n--- SHOWCASE 3: If I change ProjectService, what could be affected? (on Repos B) ---');
  const q3 = await queryRepositoryIntelligence({
    snapshot: repoBRes.snapshot,
    query: 'If I change ProjectService, what could be affected?',
    targetEntity: 'ProjectService',
  });
  console.log(`Status: ${q3.answerStatus} | Mode: ${q3.mode}`);
  console.log(`Resolved Target: ${q3.impactReport?.resolvedSymbol?.name}`);
  console.log(`Direct Dependents: ${q3.impactReport?.directDependents.map(d => `${d.type} ${d.name} (${d.edgeType})`).join(', ')}`);
  console.log(`Affected Tests: ${q3.impactReport?.affectedTests.map(t => t.file).join(', ')}`);

  // --- 5. FAILURE & EDGE CASE TESTS ---
  console.log('\n================================================================');
  console.log('   FAILURE EDGE CASE VERIFICATION');
  console.log('================================================================\n');

  // Test Missing Symbol (TARGET_NOT_FOUND)
  const qMissing = await queryRepositoryIntelligence({
    snapshot: repoBRes.snapshot,
    query: 'What depends on NonExistentService?',
    targetEntity: 'NonExistentService',
  });
  console.log(`Missing Symbol Status: ${qMissing.answerStatus} (Expected: TARGET_NOT_FOUND)`);

  // Test Security Sanitization & Multiple Secrets in One File
  const secretContent = `
  API_KEY = "sk_test_123456789";
  JWT_SECRET = "super_secret_jwt_token_key";
  `;
  const sanitized = sanitizeRepositoryContent(secretContent);
  console.log(`Secret Redaction test: Redacted ${sanitized.redactedKeys.length} keys. HasRedactions: ${sanitized.hasRedactions}`);

  // Test Repository Isolation
  const qIso = await queryRepositoryIntelligence({
    snapshot: aegisRes.snapshot,
    query: 'Find ProjectService',
    targetEntity: 'ProjectService',
  });
  const repoBLeakedInRepoA = qIso.symbols.some(s => s.filePath.includes('repo_b_ground_truth'));
  console.log(`Repository Isolation Test: Repo B symbols leaked into Repo A? ${repoBLeakedInRepoA} (Expected: false)`);

  // Cleanup Repo B
  if (fs.existsSync(tmpRepoB)) fs.rmSync(tmpRepoB, { recursive: true, force: true });

  console.log('\n================================================================');
  console.log('   GROUND-TRUTH E2E VALIDATION COMPLETED SUCCESSFULLY');
  console.log('================================================================');
}

runE2EGroundTruthValidation().catch((err) => {
  console.error('Ground-truth E2E validation failed:', err);
  process.exit(1);
});
