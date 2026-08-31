/**
 * memory/short-term/shortTermMemory.ts
 *
 * Feature 21 — Short-Term Memory
 *
 * Provides execution-scoped, in-memory context storage for active runs.
 * Supports adding, retrieving, searching, and clearing temporary execution state
 * strictly isolated per `runId`.
 */

import {
  ShortTermMemoryEntry,
  ShortTermMemoryCategory,
} from "../types";

export class ShortTermMemory {
  /**
   * Internal store: Map<runId, Map<key, ShortTermMemoryEntry>>
   */
  private stores: Map<string, Map<string, ShortTermMemoryEntry>> = new Map();

  /**
   * Store or update a short-term memory entry for a specific execution run.
   */
  public set(
    runId: string,
    key: string,
    value: any,
    category: ShortTermMemoryCategory = "context",
    metadata?: Record<string, any>
  ): ShortTermMemoryEntry {
    if (!this.stores.has(runId)) {
      this.stores.set(runId, new Map());
    }

    const runStore = this.stores.get(runId)!;
    const existing = runStore.get(key);

    const entry: ShortTermMemoryEntry = {
      id: existing?.id || `stm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      runId,
      key,
      value,
      category,
      timestamp: Date.now(),
      metadata,
    };

    runStore.set(key, entry);
    return entry;
  }

  /**
   * Retrieve value of a short-term memory entry by key for a specific run.
   */
  public get<T = any>(runId: string, key: string): T | null {
    const runStore = this.stores.get(runId);
    if (!runStore) return null;
    const entry = runStore.get(key);
    return entry ? (entry.value as T) : null;
  }

  /**
   * Retrieve full short-term memory entry by key for a specific run.
   */
  public getEntry(runId: string, key: string): ShortTermMemoryEntry | null {
    const runStore = this.stores.get(runId);
    if (!runStore) return null;
    return runStore.get(key) || null;
  }

  /**
   * Get all memory entries for a specific run matching a category.
   */
  public getCategory(
    runId: string,
    category: ShortTermMemoryCategory
  ): ShortTermMemoryEntry[] {
    const runStore = this.stores.get(runId);
    if (!runStore) return [];
    return Array.from(runStore.values()).filter((e) => e.category === category);
  }

  /**
   * Get all short-term memory entries for a run.
   */
  public getAll(runId: string): ShortTermMemoryEntry[] {
    const runStore = this.stores.get(runId);
    if (!runStore) return [];
    return Array.from(runStore.values());
  }

  /**
   * Search short-term memory entries for a run matching a query substring.
   */
  public search(runId: string, query: string): ShortTermMemoryEntry[] {
    const all = this.getAll(runId);
    if (!query || !query.trim()) return all;

    const q = query.toLowerCase().trim();
    return all.filter((entry) => {
      if (entry.key.toLowerCase().includes(q)) return true;
      if (typeof entry.value === "string" && entry.value.toLowerCase().includes(q)) return true;
      if (entry.category.toLowerCase().includes(q)) return true;
      if (entry.metadata && JSON.stringify(entry.metadata).toLowerCase().includes(q)) return true;
      return false;
    });
  }

  /**
   * Delete a specific key entry for a run.
   */
  public delete(runId: string, key: string): boolean {
    const runStore = this.stores.get(runId);
    if (!runStore) return false;
    return runStore.delete(key);
  }

  /**
   * Clear all short-term memories for a specific run.
   */
  public clear(runId: string): void {
    this.stores.delete(runId);
  }

  /**
   * Clear all short-term memory across all runs.
   */
  public clearAll(): void {
    this.stores.clear();
  }
}
