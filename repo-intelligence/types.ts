/**
 * Aegis Repository Intelligence Engine — Core Types & Schemas
 */

export type RepositoryProvider = 'github' | 'local' | 'other';
export type RepositoryStatus = 'pending' | 'analyzing' | 'ready' | 'failed';

export interface RepositoryMetadataSummary {
  analyzerVersion: string;
  fileCount: number;
  sourceFileCount: number;
  symbolCount: number;
  relationshipCount: number;
  apiCount: number;
  databaseModelCount: number;
  testCount: number;
  unsupportedLanguageCount: number;
}

export interface Repository {
  id: string;
  provider: RepositoryProvider;
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
  analyzedRevision: string;
  commitSha: string;
  status: RepositoryStatus;
  createdAt: string;
  updatedAt: string;
  statusReason?: string;
  metadata?: RepositoryMetadataSummary;
}

export type FileCategory =
  | 'SOURCE'
  | 'TEST'
  | 'CONFIG'
  | 'DOCUMENTATION'
  | 'SCHEMA'
  | 'MIGRATION'
  | 'GENERATED'
  | 'ASSET'
  | 'LOCKFILE'
  | 'BINARY'
  | 'UNKNOWN';

export interface FileRecord {
  id: string;
  repoId: string;
  path: string;
  name: string;
  extension: string;
  language: string;
  size: number;
  hash: string;
  category: FileCategory;
  lines: number;
  revision: string;
}

export type SymbolKind =
  | 'class'
  | 'interface'
  | 'type'
  | 'function'
  | 'method'
  | 'enum'
  | 'variable'
  | 'constant'
  | 'component'
  | 'constructor'
  | 'property';

export interface SymbolParameter {
  name: string;
  type?: string;
  optional?: boolean;
}

export interface SymbolRecord {
  id: string;
  repoId: string;
  fileId: string;
  filePath: string;
  name: string;
  kind: SymbolKind;
  startLine: number;
  endLine: number;
  parentSymbolId?: string;
  exported: boolean;
  visibility?: 'public' | 'private' | 'protected';
  parameters?: SymbolParameter[];
  returnType?: string;
  language: string;
  extendsClause?: string;
  implementsClause?: string[];
  calls?: Array<{ targetName: string; line: number }>;
}

export interface ImportExportRecord {
  id: string;
  repoId: string;
  fileId: string;
  filePath: string;
  type: 'import' | 'export';
  moduleSpecifier: string;
  resolvedFilePath?: string;
  symbols: string[];
  line: number;
}

export interface DependencyRecord {
  id: string;
  repoId: string;
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer' | 'workspace';
  packageManager: string;
  manifestPath: string;
  usedBySymbols?: string[];
}

export type ConfidenceLevel = 'exact' | 'inferred' | 'unresolved';

export interface ApiRecord {
  id: string;
  repoId: string;
  fileId: string;
  filePath: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL' | 'UNKNOWN';
  path: string;
  handlerName: string;
  handlerSymbolId?: string;
  confidence: ConfidenceLevel;
}

export interface DatabaseRecord {
  id: string;
  repoId: string;
  fileId: string;
  filePath: string;
  technology: 'prisma' | 'mongoose' | 'typeorm' | 'sequelize' | 'drizzle' | 'sql' | 'other';
  entityType: 'model' | 'schema' | 'repository' | 'table';
  name: string;
  fields?: string[];
  relations?: string[];
  queries?: string[];
}

export interface TestRecord {
  id: string;
  repoId: string;
  fileId: string;
  filePath: string;
  testName: string;
  framework: string;
  targetFilePaths: string[];
  targetSymbolIds: string[];
}

export interface GitCommitRecord {
  id: string;
  repoId: string;
  sha: string;
  author: string;
  email: string;
  timestamp: string;
  message: string;
  changedFiles: string[];
  additions: number;
  deletions: number;
}

export type RelationshipType =
  | 'CONTAINS'
  | 'IMPORTS'
  | 'IMPORTED_BY'
  | 'EXPORTS'
  | 'EXPORTED_BY'
  | 'EXTENDS'
  | 'IMPLEMENTS'
  | 'CALLS'
  | 'CALLED_BY'
  | 'USES'
  | 'USED_BY'
  | 'READS'
  | 'WRITES'
  | 'HANDLES'
  | 'TESTED_BY'
  | 'QUERIES';

export type EntityType = 'file' | 'symbol' | 'api' | 'database' | 'test' | 'dependency';

export interface EvidenceRecord {
  filePath: string;
  startLine?: number;
  endLine?: number;
  snippet?: string;
  reason?: string;
}

export interface RelationshipRecord {
  id: string;
  repoId: string;
  sourceId: string;
  sourceType: EntityType;
  targetId: string;
  targetType: EntityType;
  type: RelationshipType;
  provenance: EvidenceRecord;
  confidence: ConfidenceLevel;
}

export interface RepositorySnapshot {
  repository: Repository;
  files: FileRecord[];
  symbols: SymbolRecord[];
  importsExports: ImportExportRecord[];
  dependencies: DependencyRecord[];
  apis: ApiRecord[];
  databases: DatabaseRecord[];
  tests: TestRecord[];
  gitCommits: GitCommitRecord[];
  relationships: RelationshipRecord[];
  unsupportedLanguages?: string[];
  analysisErrors?: Array<{ filePath?: string; error: string }>;
}

export interface ConnectionValidationResult {
  valid: boolean;
  repository?: Partial<Repository>;
  error?: string;
  readable?: boolean;
}

export interface RepositoryIntelligenceStore {
  saveSnapshot(snapshot: RepositorySnapshot): Promise<void>;
  getSnapshot(repoId: string): Promise<RepositorySnapshot | null>;
  getRepository(repoId: string): Promise<Repository | null>;
  listRepositories(): Promise<Repository[]>;
  deleteSnapshot(repoId: string): Promise<boolean>;
  
  // Specific entity lookups
  findFiles(repoId: string, filter?: Partial<FileRecord>): Promise<FileRecord[]>;
  findSymbols(repoId: string, filter?: Partial<SymbolRecord>): Promise<SymbolRecord[]>;
  getRelationships(repoId: string, entityId: string): Promise<RelationshipRecord[]>;
  findApis(repoId: string): Promise<ApiRecord[]>;
  findDatabases(repoId: string): Promise<DatabaseRecord[]>;
  findTests(repoId: string): Promise<TestRecord[]>;
}
