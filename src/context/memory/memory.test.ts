/**
 * memory/memory.test.ts
 *
 * Feature 21 — Short-Term Memory
 * Feature 22 — Long-Term Memory
 *
 * Test suite verifying short-term memory, long-term memory, persistence across restarts,
 * run isolation, memory manager API, RAG distinction, and agent access patterns.
 */

import * as fs from "fs";
import * as path from "path";
import { ShortTermMemory } from "./short-term/shortTermMemory";
import { LongTermMemory } from "./long-term/longTermMemory";
import { MemoryManager, createMemoryManager } from "./memoryManager";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("  AEGIS MEMORY TEST SUITE (Features 21 & 22)");
  console.log("=================================================\n");

  let passed = 0;

  // ── Test 1: Short-Term Memory CRUD Operations ──────────────────────────────
  {
    console.log("Test 1: Short-Term Memory CRUD Operations...");
    const stm = new ShortTermMemory();
    const runId = "run_101";

    const entry = stm.set(runId, "current_step", "Step 1: Ingest Repo", "scratchpad");
    assert(entry.runId === runId, "Entry should have correct runId");
    assert(entry.key === "current_step", "Entry should have correct key");

    const retrieved = stm.get<string>(runId, "current_step");
    assert(retrieved === "Step 1: Ingest Repo", "retrieved value should match");

    stm.set(runId, "active_agent", "planner", "agent_state");

    const scratchpadEntries = stm.getCategory(runId, "scratchpad");
    assert(scratchpadEntries.length === 1, "Should find 1 scratchpad entry");

    const searchResults = stm.search(runId, "Ingest");
    assert(searchResults.length === 1, "Search for 'Ingest' should find 1 entry");

    stm.delete(runId, "current_step");
    assert(stm.get(runId, "current_step") === null, "Deleted key should return null");

    console.log("  ✅ Passed Short-Term Memory CRUD operations\n");
    passed++;
  }

  // ── Test 2: Short-Term Memory Run Isolation ────────────────────────────────
  {
    console.log("Test 2: Short-Term Memory Run Isolation...");
    const stm = new ShortTermMemory();
    const runA = "run_alpha";
    const runB = "run_beta";

    stm.set(runA, "temp_data", "Data Alpha", "context");
    stm.set(runB, "temp_data", "Data Beta", "context");

    assert(stm.get(runA, "temp_data") === "Data Alpha", "Run A should get Data Alpha");
    assert(stm.get(runB, "temp_data") === "Data Beta", "Run B should get Data Beta");

    // Clear Run A only
    stm.clear(runA);

    assert(stm.get(runA, "temp_data") === null, "Run A should be cleared");
    assert(stm.get(runB, "temp_data") === "Data Beta", "Run B should remain untouched");

    console.log("  ✅ Passed Short-Term Memory Run Isolation\n");
    passed++;
  }

  // ── Test 3: Long-Term Memory CRUD Operations ───────────────────────────────
  {
    console.log("Test 3: Long-Term Memory CRUD Operations...");
    const tempFile = path.join(__dirname, "temp_test_ltm_crud.json");
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

    try {
      const ltm = new LongTermMemory({ storageFilePath: tempFile });

      const rec = ltm.add({
        projectId: "proj_99",
        category: "decision",
        key: "db_choice",
        content: "Use PostgreSQL for relational metadata",
        metadata: { status: "accepted" },
      });

      assert(rec.key === "db_choice", "Record key should match");

      const fetched = ltm.get(rec.id);
      assert(fetched !== null && fetched.content.includes("PostgreSQL"), "Fetched record content should match");

      const byKey = ltm.getByKey("db_choice", "decision", "proj_99");
      assert(byKey !== null && byKey.id === rec.id, "getByKey should locate the record");

      const updated = ltm.update(rec.id, { content: "Use PostgreSQL with PG pool" });
      assert(updated?.content === "Use PostgreSQL with PG pool", "Updated content should reflect");

      const queried = ltm.query({ category: "decision" });
      assert(queried.length === 1, "Query by category decision should return 1 record");

      const deleted = ltm.delete(rec.id);
      assert(deleted === true, "delete should return true");
      assert(ltm.get(rec.id) === null, "Deleted record should not exist");

      console.log("  ✅ Passed Long-Term Memory CRUD Operations\n");
      passed++;
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  }

  // ── Test 4: Long-Term Memory Disk Persistence Across Restarts ───────────────
  {
    console.log("Test 4: Long-Term Memory Persistence Across Restarts...");
    const tempFile = path.join(__dirname, "temp_test_ltm_persist.json");
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

    try {
      // Phase 1: Create instance and write data
      const ltm1 = new LongTermMemory({ storageFilePath: tempFile });
      ltm1.add({
        category: "architecture_rule",
        key: "state_management",
        content: "Use LangGraph Annotation API for all graph state",
      });
      ltm1.add({
        category: "preference",
        key: "coding_style",
        content: "TypeScript strictly typed without any types",
      });

      // Phase 2: Simulate restart by constructing fresh instance pointing to same file
      const ltm2 = new LongTermMemory({ storageFilePath: tempFile });
      const records = ltm2.query();

      assert(records.length === 2, "Re-hydrated instance should contain 2 records");
      const rule = ltm2.getByKey("state_management");
      assert(rule !== null && rule.content.includes("LangGraph Annotation API"), "Persisted rule content should be reloaded");

      console.log("  ✅ Passed Long-Term Memory Persistence Across Restarts\n");
      passed++;
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  }

  // ── Test 5: Memory Manager Unified API & Prompt Context Formatting ──────────
  {
    console.log("Test 5: Memory Manager API & Context Formatting...");
    const tempFile = path.join(__dirname, "temp_test_mm.json");
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

    try {
      const mm = createMemoryManager({ longTermConfig: { storageFilePath: tempFile } });
      const runId = "run_202";

      // Populate short-term memory
      mm.shortTerm.set(runId, "current_focus", "Fixing auth token expiration", "scratchpad");

      // Populate long-term memory
      mm.longTerm.add({
        category: "architecture_rule",
        key: "auth_token",
        content: "JWT access tokens expire after 15 minutes; refresh tokens after 7 days.",
      });

      const formatted = mm.getFormattedMemoryContext({ runId, includeShortTerm: true, includeLongTerm: true });

      assert(formatted.includes("=== AEGIS MEMORY CONTEXT ==="), "Formatted context should contain header");
      assert(formatted.includes("Active Run Context (Short-Term Memory)"), "Should contain Short-Term section");
      assert(formatted.includes("Persistent Project Knowledge (Long-Term Memory)"), "Should contain Long-Term section");
      assert(formatted.includes("Fixing auth token expiration"), "Should contain short-term value");
      assert(formatted.includes("JWT access tokens expire"), "Should contain long-term content");

      console.log("  ✅ Passed Memory Manager API & Context Formatting\n");
      passed++;
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  }

  // ── Test 6: Clear Distinction Between Memory and RAG ────────────────────────
  {
    console.log("Test 6: RAG vs Memory Context Distinction...");
    const mm = createMemoryManager({ longTermConfig: { storageFilePath: null } });
    const runId = "run_rag_vs_mem";

    mm.shortTerm.set(runId, "execution_phase", "Testing auth module", "step_note");
    mm.longTerm.add({
      category: "decision",
      key: "testing_framework",
      content: "Use custom zero-dependency tsx test runner for graph tests",
    });

    const memoryContext = mm.getFormattedMemoryContext({ runId });

    // Mock RAG context for comparison
    const ragContext = `=== PROJECT KNOWLEDGE CONTEXT ===\n[PROJECT KNOWLEDGE Chunk 1]\nSource: src/auth.ts\nContent: function verifyToken() { ... }`;

    assert(memoryContext.includes("AEGIS MEMORY CONTEXT"), "Memory context should use AEGIS MEMORY CONTEXT banner");
    assert(!memoryContext.includes("PROJECT KNOWLEDGE Chunk"), "Memory context must not mimic RAG chunk output");
    assert(ragContext.includes("PROJECT KNOWLEDGE"), "RAG context retains RAG banner");

    console.log("  ✅ Passed RAG vs Memory Context Distinction\n");
    passed++;
  }

  // ── Test 7: Agent Access Integration Pattern ───────────────────────────────
  {
    console.log("Test 7: Agent Access Integration Pattern...");
    const mm = createMemoryManager({ longTermConfig: { storageFilePath: null } });
    const runId = "run_agent_access";

    // Set short term context
    mm.shortTerm.set(runId, "architectural_notes", "User requested REST over GraphQL", "context");

    // Agent queries memory when needed
    const contextForAgent = mm.getFormattedMemoryContext({ runId, includeShortTerm: true });
    assert(contextForAgent.includes("User requested REST over GraphQL"), "Agent prompt context should include short term memory");

    console.log("  ✅ Passed Agent Access Integration Pattern\n");
    passed++;
  }

  console.log("=================================================");
  console.log(` SUMMARY: ${passed} / 7 test blocks passed successfully.`);
  console.log("=================================================\n");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed with error:", err);
  process.exit(1);
});
