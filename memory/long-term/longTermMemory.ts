/**
 * memory/long-term/longTermMemory.ts
 *
 * Feature 22 — Long-Term Memory
 *
 * Provides persistent storage for Aegis architectural decisions, project rules,
 * learned patterns, and user preferences that survive across execution runs and process restarts.
 */

import * as fs from "fs";
import * as path from "path";
import {
  LongTermMemoryRecord,
  CreateLongTermMemoryInput,
  UpdateLongTermMemoryInput,
  QueryLongTermMemoryOptions,
  LongTermMemoryCategory,
} from "../types";

export interface LongTermMemoryConfig {
  /** File path for JSON persistence. Pass empty string or null for pure in-memory mode */
  storageFilePath?: string | null;
  /** Disable automatic disk sync on writes (e.g. for testing) */
  autoSave?: boolean;
}

export class LongTermMemory {
  private records: Map<string, LongTermMemoryRecord> = new Map();
  private storageFilePath: string | null;
  private autoSave: boolean;

  constructor(config?: LongTermMemoryConfig) {
    this.storageFilePath =
      config?.storageFilePath !== undefined
        ? config.storageFilePath
        : path.join(__dirname, "storage.json");
    this.autoSave = config?.autoSave ?? true;

    this.loadFromDisk();
  }

  /**
   * Load existing persistent records from disk if storage file exists.
   */
  public loadFromDisk(): void {
    if (!this.storageFilePath) return;
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const fileContent = fs.readFileSync(this.storageFilePath, "utf-8");
        if (fileContent.trim()) {
          const parsed: LongTermMemoryRecord[] = JSON.parse(fileContent);
          this.records.clear();
          for (const item of parsed) {
            this.records.set(item.id, item);
          }
        }
      }
    } catch (err) {
      console.warn(`[LongTermMemory] Failed to load disk persistence from ${this.storageFilePath}:`, err);
    }
  }

  /**
   * Persist current records to disk JSON file.
   */
  public saveToDisk(): void {
    if (!this.storageFilePath) return;
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = JSON.stringify(Array.from(this.records.values()), null, 2);
      fs.writeFileSync(this.storageFilePath, data, "utf-8");
    } catch (err) {
      console.error(`[LongTermMemory] Failed to save persistence to ${this.storageFilePath}:`, err);
    }
  }

  /**
   * Add a new long-term memory record.
   */
  public add(input: CreateLongTermMemoryInput): LongTermMemoryRecord {
    const now = Date.now();
    const record: LongTermMemoryRecord = {
      id: `ltm_${now}_${Math.random().toString(36).substring(2, 7)}`,
      projectId: input.projectId,
      category: input.category,
      key: input.key,
      content: input.content,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.records.set(record.id, record);

    if (this.autoSave) {
      this.saveToDisk();
    }

    return record;
  }

  /**
   * Retrieve record by unique record ID.
   */
  public get(id: string): LongTermMemoryRecord | null {
    return this.records.get(id) || null;
  }

  /**
   * Find a record matching key, optional category, and optional projectId.
   */
  public getByKey(
    key: string,
    category?: LongTermMemoryCategory,
    projectId?: string
  ): LongTermMemoryRecord | null {
    for (const record of this.records.values()) {
      if (record.key === key) {
        if (category && record.category !== category) continue;
        if (projectId && record.projectId !== projectId) continue;
        return record;
      }
    }
    return null;
  }

  /**
   * Query long-term memory records based on filters.
   */
  public query(options?: QueryLongTermMemoryOptions): LongTermMemoryRecord[] {
    let results = Array.from(this.records.values());

    if (!options) return results;

    if (options.projectId) {
      results = results.filter(
        (r) => r.projectId === options.projectId || !r.projectId
      );
    }

    if (options.category) {
      results = results.filter((r) => r.category === options.category);
    }

    if (options.query && options.query.trim()) {
      const q = options.query.toLowerCase().trim();
      results = results.filter(
        (r) =>
          r.key.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r.metadata && JSON.stringify(r.metadata).toLowerCase().includes(q))
      );
    }

    // Sort newest updated first
    results.sort((a, b) => b.updatedAt - a.updatedAt);

    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Update an existing long-term memory record.
   */
  public update(
    id: string,
    updates: UpdateLongTermMemoryInput
  ): LongTermMemoryRecord | null {
    const record = this.records.get(id);
    if (!record) return null;

    if (updates.category) record.category = updates.category;
    if (updates.key) record.key = updates.key;
    if (updates.content !== undefined) record.content = updates.content;
    if (updates.metadata) {
      record.metadata = { ...record.metadata, ...updates.metadata };
    }
    record.updatedAt = Date.now();

    if (this.autoSave) {
      this.saveToDisk();
    }

    return record;
  }

  /**
   * Delete a record by ID.
   */
  public delete(id: string): boolean {
    const existed = this.records.delete(id);
    if (existed && this.autoSave) {
      this.saveToDisk();
    }
    return existed;
  }

  /**
   * Clear all long-term memory records.
   */
  public clear(): void {
    this.records.clear();
    if (this.autoSave) {
      this.saveToDisk();
    }
  }
}
