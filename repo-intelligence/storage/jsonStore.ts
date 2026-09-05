/**
 * Aegis Repository Intelligence Engine — JSON File Store
 * 
 * File-backed persistent implementation of RepositoryIntelligenceStore.
 * Serves as the primary production storage for isolation, speed, and reliability.
 */

import fs from 'fs';
import path from 'path';
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

export class JsonRepositoryStore implements RepositoryIntelligenceStore {
  private baseDir: string;

  constructor(customStorageDir?: string) {
    if (customStorageDir) {
      this.baseDir = path.resolve(customStorageDir);
    } else {
      const appDataDir = process.env.AEGIS_APP_DATA_DIR || path.join(process.cwd(), '.gemini', 'antigravity-ide');
      this.baseDir = path.join(appDataDir, 'brain', 'repo_intelligence');
    }
    this.ensureDirExists();
  }

  private ensureDirExists() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getSnapshotFilePath(repoId: string): string {
    const safeRepoId = repoId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.baseDir, `${safeRepoId}.snapshot.json`);
  }

  private getIndexFilePath(): string {
    return path.join(this.baseDir, 'index.json');
  }

  async saveSnapshot(snapshot: RepositorySnapshot): Promise<void> {
    this.ensureDirExists();
    const filePath = this.getSnapshotFilePath(snapshot.repository.id);
    const tempPath = `${filePath}.tmp`;

    // 1. Write snapshot atomically
    const serialized = JSON.stringify(snapshot, null, 2);
    fs.writeFileSync(tempPath, serialized, 'utf-8');
    fs.renameSync(tempPath, filePath);

    // 2. Update index file
    const index = await this.loadIndex();
    index[snapshot.repository.id] = snapshot.repository;
    fs.writeFileSync(this.getIndexFilePath(), JSON.stringify(index, null, 2), 'utf-8');
  }

  private async loadIndex(): Promise<Record<string, Repository>> {
    const indexFile = this.getIndexFilePath();
    if (!fs.existsSync(indexFile)) return {};
    try {
      const raw = fs.readFileSync(indexFile, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async getSnapshot(repoId: string): Promise<RepositorySnapshot | null> {
    const filePath = this.getSnapshotFilePath(repoId);
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as RepositorySnapshot;
    } catch (err) {
      console.error(`[JsonRepositoryStore] Failed to read snapshot for repoId=${repoId}`, err);
      return null;
    }
  }

  async getRepository(repoId: string): Promise<Repository | null> {
    const index = await this.loadIndex();
    if (index[repoId]) return index[repoId];

    const snapshot = await this.getSnapshot(repoId);
    return snapshot ? snapshot.repository : null;
  }

  async listRepositories(): Promise<Repository[]> {
    const index = await this.loadIndex();
    return Object.values(index);
  }

  async deleteSnapshot(repoId: string): Promise<boolean> {
    const filePath = this.getSnapshotFilePath(repoId);
    let deleted = false;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      deleted = true;
    }

    const index = await this.loadIndex();
    if (index[repoId]) {
      delete index[repoId];
      fs.writeFileSync(this.getIndexFilePath(), JSON.stringify(index, null, 2), 'utf-8');
      deleted = true;
    }

    return deleted;
  }

  async findFiles(repoId: string, filter?: Partial<FileRecord>): Promise<FileRecord[]> {
    const snapshot = await this.getSnapshot(repoId);
    if (!snapshot) return [];

    let result = snapshot.files;
    if (filter) {
      result = result.filter((f) => {
        for (const [key, val] of Object.entries(filter)) {
          if (val !== undefined && (f as any)[key] !== val) return false;
        }
        return true;
      });
    }
    return result;
  }

  async findSymbols(repoId: string, filter?: Partial<SymbolRecord>): Promise<SymbolRecord[]> {
    const snapshot = await this.getSnapshot(repoId);
    if (!snapshot) return [];

    let result = snapshot.symbols;
    if (filter) {
      result = result.filter((s) => {
        for (const [key, val] of Object.entries(filter)) {
          if (val !== undefined && (s as any)[key] !== val) return false;
        }
        return true;
      });
    }
    return result;
  }

  async getRelationships(repoId: string, entityId: string): Promise<RelationshipRecord[]> {
    const snapshot = await this.getSnapshot(repoId);
    if (!snapshot) return [];

    return snapshot.relationships.filter(
      (r) => r.sourceId === entityId || r.targetId === entityId
    );
  }

  async findApis(repoId: string): Promise<ApiRecord[]> {
    const snapshot = await this.getSnapshot(repoId);
    return snapshot ? snapshot.apis : [];
  }

  async findDatabases(repoId: string): Promise<DatabaseRecord[]> {
    const snapshot = await this.getSnapshot(repoId);
    return snapshot ? snapshot.databases : [];
  }

  async findTests(repoId: string): Promise<TestRecord[]> {
    const snapshot = await this.getSnapshot(repoId);
    return snapshot ? snapshot.tests : [];
  }
}
