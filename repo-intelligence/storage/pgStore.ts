/**
 * Aegis Repository Intelligence Engine — PostgreSQL Adapter
 * 
 * Production PostgreSQL implementation of RepositoryIntelligenceStore storing
 * repository records, snapshots, files, symbols, and provenanced edges.
 */

import { checkDbConnection, query, queryOne } from '../../apps/api/db';
import {
  ApiRecord,
  DatabaseRecord,
  FileRecord,
  RelationshipRecord,
  Repository,
  RepositoryIntelligenceStore,
  RepositorySnapshot,
  SymbolRecord,
  TestRecord,
} from '../types';
import { JsonRepositoryStore } from './jsonStore';

export class PgRepositoryStore implements RepositoryIntelligenceStore {
  private fallbackStore: JsonRepositoryStore;

  constructor(customStorageDir?: string) {
    this.fallbackStore = new JsonRepositoryStore(customStorageDir);
  }

  private async isPgAvailable(): Promise<boolean> {
    try {
      return await checkDbConnection();
    } catch {
      return false;
    }
  }

  async saveSnapshot(snapshot: RepositorySnapshot): Promise<void> {
    await this.fallbackStore.saveSnapshot(snapshot);

    if (!(await this.isPgAvailable())) return;

    try {
      // 1. Upsert repositories table
      await query(
        `INSERT INTO repositories (id, provider, owner, name, url, default_branch, analyzed_revision, commit_sha, status, metadata, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           analyzed_revision = EXCLUDED.analyzed_revision,
           commit_sha = EXCLUDED.commit_sha,
           metadata = EXCLUDED.metadata,
           updated_at = NOW();`,
        [
          snapshot.repository.id,
          snapshot.repository.provider,
          snapshot.repository.owner,
          snapshot.repository.name,
          snapshot.repository.url,
          snapshot.repository.defaultBranch,
          snapshot.repository.analyzedRevision,
          snapshot.repository.commitSha,
          snapshot.repository.status,
          JSON.stringify(snapshot.repository.metadata || {}),
        ]
      );

      // 2. Upsert full snapshot JSON for atomic process reload
      await query(
        `INSERT INTO repository_snapshots (repo_id, snapshot_data, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (repo_id) DO UPDATE SET
           snapshot_data = EXCLUDED.snapshot_data,
           updated_at = NOW();`,
        [snapshot.repository.id, JSON.stringify(snapshot)]
      );

      // 3. Batch insert files
      for (const file of snapshot.files.slice(0, 500)) {
        await query(
          `INSERT INTO repository_files (id, repo_id, path, category, language, lines)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET path = EXCLUDED.path, category = EXCLUDED.category;`,
          [file.id, file.repoId, file.path, file.category, file.language, file.lines]
        );
      }

      // 4. Batch insert symbols
      for (const sym of snapshot.symbols.slice(0, 1000)) {
        await query(
          `INSERT INTO repository_symbols (id, repo_id, file_path, name, kind, start_line, end_line, exported)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, file_path = EXCLUDED.file_path;`,
          [sym.id, sym.repoId, sym.filePath, sym.name, sym.kind, sym.startLine, sym.endLine, sym.exported]
        );
      }

      // 5. Batch insert relationship edges
      for (const edge of snapshot.relationships.slice(0, 1000)) {
        await query(
          `INSERT INTO repository_edges (id, repo_id, source_id, target_id, type, confidence, provenance)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, confidence = EXCLUDED.confidence;`,
          [edge.id, edge.repoId, edge.sourceId, edge.targetId, edge.type, edge.confidence, JSON.stringify(edge.provenance)]
        );
      }
    } catch (err) {
      console.warn('[PgRepositoryStore] PostgreSQL store sync warning:', err);
    }
  }

  async getSnapshot(repoId: string): Promise<RepositorySnapshot | null> {
    if (await this.isPgAvailable()) {
      try {
        const row = await queryOne<any>('SELECT snapshot_data FROM repository_snapshots WHERE repo_id = $1', [repoId]);
        if (row && row.snapshot_data) {
          return typeof row.snapshot_data === 'string' ? JSON.parse(row.snapshot_data) : row.snapshot_data;
        }
      } catch {}
    }
    return this.fallbackStore.getSnapshot(repoId);
  }

  async getRepository(repoId: string): Promise<Repository | null> {
    if (await this.isPgAvailable()) {
      try {
        const row = await queryOne<any>('SELECT * FROM repositories WHERE id = $1', [repoId]);
        if (row) {
          return {
            id: row.id,
            provider: row.provider,
            owner: row.owner,
            name: row.name,
            url: row.url,
            defaultBranch: row.default_branch || row.defaultbranch,
            analyzedRevision: row.analyzed_revision || row.analyzedrevision,
            commitSha: row.commit_sha || row.commitsha,
            status: row.status,
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString(),
          };
        }
      } catch {}
    }
    return this.fallbackStore.getRepository(repoId);
  }

  async listRepositories(): Promise<Repository[]> {
    return this.fallbackStore.listRepositories();
  }

  async deleteSnapshot(repoId: string): Promise<boolean> {
    if (await this.isPgAvailable()) {
      try {
        await query('DELETE FROM repositories WHERE id = $1', [repoId]);
      } catch {}
    }
    return this.fallbackStore.deleteSnapshot(repoId);
  }

  async findFiles(repoId: string, filter?: Partial<FileRecord>): Promise<FileRecord[]> {
    return this.fallbackStore.findFiles(repoId, filter);
  }

  async findSymbols(repoId: string, filter?: Partial<SymbolRecord>): Promise<SymbolRecord[]> {
    return this.fallbackStore.findSymbols(repoId, filter);
  }

  async getRelationships(repoId: string, entityId: string): Promise<RelationshipRecord[]> {
    return this.fallbackStore.getRelationships(repoId, entityId);
  }

  async findApis(repoId: string): Promise<ApiRecord[]> {
    return this.fallbackStore.findApis(repoId);
  }

  async findDatabases(repoId: string): Promise<DatabaseRecord[]> {
    return this.fallbackStore.findDatabases(repoId);
  }

  async findTests(repoId: string): Promise<TestRecord[]> {
    return this.fallbackStore.findTests(repoId);
  }
}
