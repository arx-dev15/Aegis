/**
 * rag/projectKnowledge.test.ts
 *
 * Feature 20 — Project Knowledge Retrieval Tests
 *
 * Tests cover:
 *   1. Project knowledge ingestion (ingestFiles / ingestProject / ingestDocument)
 *   2. Metadata preservation (source paths, scores, indices)
 *   3. Retrieval of relevant project knowledge (queryKnowledge)
 *   4. Safe handling of empty/irrelevant queries
 *   5. Configurable Top-K retrieval
 *   6. Context formatting (getFormattedContext & enhanceContext)
 *   7. Agent context integration (existing agent consumes retrieved context without breaking)
 *
 * Run with:
 *   npx tsx rag/projectKnowledge.test.ts
 */

import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ProjectKnowledge } from "./projectKnowledge.js";
import { RagPipeline } from "./pipeline.js";
import { InMemoryVectorStore } from "./vector-store/inMemoryStore.js";
import type { EmbedderInterface } from "./embeddings/geminiEmbedder.js";
import { ResearcherAgent } from "../agents/researcher/researcher.js";
import type { ResearcherModel } from "../agents/researcher/researcher.js";
import type { ResearchResult } from "../agents/researcher/types.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

// ── Mock Embedder (deterministic character-based vector calculation) ─────────

function createMockEmbedder(dim = 16): EmbedderInterface {
  function textToVector(text: string): number[] {
    const vec = new Array<number>(dim).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % dim]! += text.charCodeAt(i) / 1000;
    }
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return mag === 0 ? vec : vec.map((v) => v / mag);
  }

  return {
    embed: async (text: string) => textToVector(text),
    embedBatch: async (texts: string[]) => texts.map(textToVector),
  };
}

// ── Mock Researcher Model for Agent Integration Test ──────────────────────────

class MockResearcherModel implements ResearcherModel {
  public lastUserPromptReceived = "";

  async generateStructured<T>(
    _systemPrompt: string,
    userPrompt: string,
    _schema: unknown
  ): Promise<T> {
    this.lastUserPromptReceived = userPrompt;
    return {
      objective: "Understand authentication design",
      summary: "JWT auth system configured with bcrypt and token rotation.",
      findings: [
        {
          id: "finding-1",
          topic: "JWT Validation",
          finding: "Uses RS256 algorithm with secret rotation.",
          evidence: "Extracted from project knowledge",
          source: "src/auth/jwt.ts",
        },
      ],
      constraints: ["Requires GOOGLE_API_KEY"],
      unknowns: [],
      risks: [],
    } as unknown as T;
  }
}

// ── Test Runner ───────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 20 — Project Knowledge Retrieval Tests ===\n");

  const mockEmbedder = createMockEmbedder(16);
  const store = new InMemoryVectorStore();
  const pipeline = new RagPipeline({ embedder: mockEmbedder, vectorStore: store });

  // ── Test 1: Project Knowledge Ingestion & Metadata Preservation ─────────────
  try {
    console.log("Test 1: Project files ingestion & metadata preservation...");

    const tmpDir = join(tmpdir(), `aegis-pk-test-${Date.now()}`);
    await mkdir(join(tmpDir, "src"), { recursive: true });

    const authFile = join(tmpDir, "src", "auth.ts");
    await writeFile(
      authFile,
      "export function verifyJwtToken(token: string): boolean {\n  return token.startsWith('bearer_');\n}"
    );

    const configFile = join(tmpDir, "src", "config.json");
    await writeFile(configFile, '{\n  "jwtSecret": "supersecretkey"\n}');

    const knowledge = new ProjectKnowledge({ pipeline });
    const count = await knowledge.ingestDirectory(tmpDir);

    if (count !== 2) {
      throw new Error(`Expected 2 chunks ingested, got ${count}`);
    }

    const results = await knowledge.queryKnowledge("verifyJwtToken", { topK: 1 });
    if (results.length === 0) {
      throw new Error("Expected at least 1 result for query");
    }

    const topResult = results[0]!;
    if (!topResult.chunk.source.includes("auth.ts")) {
      throw new Error(`Expected source to contain auth.ts, got ${topResult.chunk.source}`);
    }
    if (typeof topResult.score !== "number" || topResult.score <= 0) {
      throw new Error(`Expected valid score, got ${topResult.score}`);
    }

    console.log(`       Ingested ${count} files. Top result source: ${topResult.chunk.source}`);
    console.log(`       Metadata score: ${topResult.score.toFixed(3)}`);
    console.log(`${PASS} Test 1: Ingestion and metadata preservation`);
    passed++;

    await rm(tmpDir, { recursive: true, force: true });
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: Safe handling of empty / irrelevant queries ──────────────────────
  try {
    console.log("\nTest 2: Safe handling of empty / invalid queries...");

    const knowledge = new ProjectKnowledge({ pipeline });

    const emptyResults = await knowledge.queryKnowledge("");
    if (emptyResults.length !== 0) {
      throw new Error("Empty query should return empty array");
    }

    const whitespaceContext = await knowledge.getFormattedContext("   ");
    if (whitespaceContext !== "") {
      throw new Error("Whitespace query should return empty string");
    }

    console.log(`       Empty query → [] (0 results) ✓`);
    console.log(`       Whitespace query → "" (empty context) ✓`);
    console.log(`${PASS} Test 2: Safe handling of empty / invalid queries`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 3: Top-K retrieval limit ───────────────────────────────────────────
  try {
    console.log("\nTest 3: Top-K retrieval limit...");

    const knowledge = new ProjectKnowledge({ pipeline });
    knowledge.clear();

    await knowledge.ingestDocument("Document chunk 1 about system architecture", "doc1.md");
    await knowledge.ingestDocument("Document chunk 2 about database schemas", "doc2.md");
    await knowledge.ingestDocument("Document chunk 3 about API routing middleware", "doc3.md");

    const top1 = await knowledge.queryKnowledge("system architecture", { topK: 1 });
    const top2 = await knowledge.queryKnowledge("system architecture", { topK: 2 });

    if (top1.length !== 1) throw new Error(`Expected topK=1 to return 1 item, got ${top1.length}`);
    if (top2.length !== 2) throw new Error(`Expected topK=2 to return 2 items, got ${top2.length}`);

    console.log(`       topK=1 returned ${top1.length} item, topK=2 returned ${top2.length} items`);
    console.log(`${PASS} Test 3: Top-K retrieval limit`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 3: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 4: Context Formatting (getFormattedContext & enhanceContext) ───────
  try {
    console.log("\nTest 4: Context Formatting & Enhancement...");

    const knowledge = new ProjectKnowledge({ pipeline });
    const formatted = await knowledge.getFormattedContext("database schemas", 2);

    if (!formatted.includes("=== PROJECT KNOWLEDGE CONTEXT ===")) {
      throw new Error("Formatted context missing header");
    }
    if (!formatted.includes("Source:")) {
      throw new Error("Formatted context missing Source label");
    }
    if (!formatted.includes("Relevance Score:")) {
      throw new Error("Formatted context missing Relevance Score");
    }

    const baseContext = "Base task research notes.";
    const enhanced = await knowledge.enhanceContext(baseContext, "database schemas", 1);

    if (!enhanced.startsWith("Base task research notes.")) {
      throw new Error("Enhanced context did not preserve base context");
    }
    if (!enhanced.includes("=== PROJECT KNOWLEDGE CONTEXT ===")) {
      throw new Error("Enhanced context did not append project knowledge");
    }

    console.log(`       Formatted context generated with headers and metadata ✓`);
    console.log(`       Enhanced context cleanly combined base notes + knowledge ✓`);
    console.log(`${PASS} Test 4: Context Formatting & Enhancement`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 4: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 5: Agent Context Integration (Existing agent consumes retrieved context) ──
  try {
    console.log("\nTest 5: Agent Context Integration (Existing agent consumes knowledge context)...");

    const knowledge = new ProjectKnowledge({ pipeline });
    const mockModel = new MockResearcherModel();
    const researcher = new ResearcherAgent(mockModel);

    const task = "Analyze authentication security in the project.";
    const knowledgeContext = await knowledge.getFormattedContext(task, 2);

    // Call researcher agent with retrieved knowledge context
    const result: ResearchResult = await researcher.research(task, knowledgeContext);

    if (!result.objective) {
      throw new Error("Agent failed to return structured result");
    }
    if (!mockModel.lastUserPromptReceived.includes("=== PROJECT KNOWLEDGE CONTEXT ===")) {
      throw new Error("Project knowledge context was not received by agent prompt");
    }

    console.log(`       Agent objective: "${result.objective}"`);
    console.log(`       Agent prompt contained retrieved project knowledge context ✓`);
    console.log(`${PASS} Test 5: Existing agent consumed project knowledge context without breaking`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 5: ${(err as Error).message}`);
    failed++;
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed (of 5 run) ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
