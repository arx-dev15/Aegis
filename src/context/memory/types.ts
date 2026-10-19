/**
 * memory/types.ts
 *
 * Feature 21 — Short-Term Memory
 * Feature 22 — Long-Term Memory
 *
 * Shared type definitions for Aegis memory architecture.
 */

// ── Short-Term Memory Types (Feature 21) ──────────────────────────────────────

export type ShortTermMemoryCategory =
  | "scratchpad"
  | "step_note"
  | "agent_state"
  | "context";

export interface ShortTermMemoryEntry {
  /** Unique ID for the memory item */
  id: string;
  /** Active execution/run ID to which this memory belongs */
  runId: string;
  /** Key identifying this memory item within the run */
  key: string;
  /** Content/payload stored in this short-term entry */
  value: any;
  /** Category of short-term memory */
  category: ShortTermMemoryCategory;
  /** Timestamp when recorded (Epoch MS) */
  timestamp: number;
  /** Optional key-value metadata */
  metadata?: Record<string, any>;
}

// ── Long-Term Memory Types (Feature 22) ───────────────────────────────────────

export type LongTermMemoryCategory =
  | "decision"
  | "preference"
  | "architecture_rule"
  | "pattern"
  | "learned_fact";

export interface LongTermMemoryRecord {
  /** Unique ID for the long-term record */
  id: string;
  /** Optional associated project ID */
  projectId?: string;
  /** Category of persistent knowledge */
  category: LongTermMemoryCategory;
  /** Human-readable key/topic identifier */
  key: string;
  /** Persistent memory content or decision details */
  content: string;
  /** Additional structured metadata */
  metadata?: Record<string, any>;
  /** Timestamp created (Epoch MS) */
  createdAt: number;
  /** Timestamp last updated (Epoch MS) */
  updatedAt: number;
}

export interface CreateLongTermMemoryInput {
  projectId?: string;
  category: LongTermMemoryCategory;
  key: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface UpdateLongTermMemoryInput {
  category?: LongTermMemoryCategory;
  key?: string;
  content?: string;
  metadata?: Record<string, any>;
}

export interface QueryLongTermMemoryOptions {
  projectId?: string;
  category?: LongTermMemoryCategory;
  query?: string;
  limit?: number;
}

// ── Memory Context Options ───────────────────────────────────────────────────

export interface FormattedMemoryContextOptions {
  runId?: string;
  projectId?: string;
  includeShortTerm?: boolean;
  includeLongTerm?: boolean;
  categories?: (ShortTermMemoryCategory | LongTermMemoryCategory)[];
  limit?: number;
}
