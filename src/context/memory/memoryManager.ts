/**
 * memory/memoryManager.ts
 *
 * Feature 21 — Short-Term Memory
 * Feature 22 — Long-Term Memory
 *
 * Unified Memory Manager providing a simple interface to access both
 * short-term run context and persistent long-term knowledge.
 */

import { ShortTermMemory } from "./short-term/shortTermMemory";
import { LongTermMemory, LongTermMemoryConfig } from "./long-term/longTermMemory";
import { FormattedMemoryContextOptions } from "./types";

export interface MemoryManagerConfig {
  longTermConfig?: LongTermMemoryConfig;
}

export class MemoryManager {
  public shortTerm: ShortTermMemory;
  public longTerm: LongTermMemory;

  constructor(config?: MemoryManagerConfig) {
    this.shortTerm = new ShortTermMemory();
    this.longTerm = new LongTermMemory(config?.longTermConfig);
  }

  /**
   * Format relevant short-term execution state and long-term persistent decisions
   * into a clean Markdown context block for agent context injection.
   *
   * RAG Distinction:
   * - RAG provides codebase content / docs search context.
   * - Short-Term Memory provides current active run execution context & scratchpad.
   * - Long-Term Memory provides persistent decisions & project preferences across runs.
   */
  public getFormattedMemoryContext(options: FormattedMemoryContextOptions = {}): string {
    const sections: string[] = [];
    const limit = options.limit ?? 5;

    // 1. Short-Term Execution Context
    if (options.includeShortTerm !== false && options.runId) {
      const stEntries = this.shortTerm.getAll(options.runId);
      if (stEntries.length > 0) {
        let filtered = stEntries;
        if (options.categories && options.categories.length > 0) {
          filtered = filtered.filter((e) => options.categories!.includes(e.category));
        }

        const lines: string[] = ["### Active Run Context (Short-Term Memory)"];
        for (const entry of filtered.slice(0, limit)) {
          const valStr = typeof entry.value === "object" ? JSON.stringify(entry.value) : String(entry.value);
          lines.push(`- **[${entry.category.toUpperCase()}] ${entry.key}**: ${valStr}`);
        }
        sections.push(lines.join("\n"));
      }
    }

    // 2. Long-Term Persistent Knowledge
    if (options.includeLongTerm !== false) {
      const ltRecords = this.longTerm.query({
        projectId: options.projectId,
        limit,
      });

      if (ltRecords.length > 0) {
        let filtered = ltRecords;
        if (options.categories && options.categories.length > 0) {
          filtered = filtered.filter((r) => options.categories!.includes(r.category));
        }

        if (filtered.length > 0) {
          const lines: string[] = ["### Persistent Project Knowledge (Long-Term Memory)"];
          for (const record of filtered.slice(0, limit)) {
            lines.push(`- **[${record.category.toUpperCase()}] ${record.key}**: ${record.content}`);
          }
          sections.push(lines.join("\n"));
        }
      }
    }

    if (sections.length === 0) return "";

    return `\n=== AEGIS MEMORY CONTEXT ===\n${sections.join("\n\n")}\n===========================\n`;
  }
}

/**
 * Factory function to create a new MemoryManager instance.
 */
export function createMemoryManager(config?: MemoryManagerConfig): MemoryManager {
  return new MemoryManager(config);
}

/**
 * Global default MemoryManager singleton.
 */
export const memoryManager = createMemoryManager();
