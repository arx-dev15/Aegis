/**
 * rag/rag.test.ts
 *
 * Feature 19 — RAG Pipeline Tests
 *
 * Tests cover:
 *   1. Document loading (loadFile / loadDirectory)
 *   2. Chunking (chunkDocument / chunkDocuments)
 *   3. Vector store (add, search, size, clear)
 *   4. Retriever (retrieve, retrieveContent, retrieveContext)
 *   5. Full pipeline (ingestText → retrieve — no live API)
 *   6. Edge cases (empty input, unsupported file, empty store)
 *   7. Live embedding integration (isolated, clearly marked)
 *
 * Tests 1–6 use mock embedders and run entirely offline.
 * Test 7 requires a live GOOGLE_API_KEY and is clearly isolated.
 *
 * Run with:
 *   npx tsx rag/rag.test.ts
 */

import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { loadFile, loadFiles, loadDirectory } from "./loaders/fileLoader.js";
import { chunkDocument, chunkDocuments } from "./chunkers/textChunker.js";
import { InMemoryVectorStore } from "./vector-store/inMemoryStore.js";
import { Retriever } from "./retriever/retriever.js";
import { RagPipeline } from "./pipeline.js";

import type { EmbedderInterface } from "./embeddings/geminiEmbedder.js";
import type { Document, Chunk } from "./types.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

// ── Mock Embedder (deterministic, no API calls) ───────────────────────────────

/**
 * Mock embedder that creates a simple deterministic embedding from text.
 * The embedding value is based on character codes, ensuring similar texts
 * have similar embeddings (not as accurate as real embeddings, but good for tests).
 */
function createMockEmbedder(dim = 8): EmbedderInterface {
  function textToVector(text: string): number[] {
    const vec = new Array<number>(dim).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % dim]! += text.charCodeAt(i) / 1000;
    }
    // Normalize
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return mag === 0 ? vec : vec.map((v) => v / mag);
  }

  return {
    embed: async (text: string) => textToVector(text),
    embedBatch: async (texts: string[]) => texts.map(textToVector),
  };
}

// ── Test runner helpers ───────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 19 — RAG Pipeline Tests ===\n");

  // ── Test 1: Document Loading — loadFile ────────────────────────────────────
  try {
    console.log("Test 1: Document loading — loadFile...");

    const tmpDir = join(tmpdir(), `aegis-rag-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });

    const tsFile = join(tmpDir, "auth.ts");
    await writeFile(tsFile, "export function validateToken(token: string): boolean { return true; }");

    const mdFile = join(tmpDir, "README.md");
    await writeFile(mdFile, "# Auth Module\nHandles JWT authentication.");

    const binFile = join(tmpDir, "image.png");
    await writeFile(binFile, "binary data");

    const tsDoc = await loadFile(tsFile);
    const mdDoc = await loadFile(mdFile);
    const binDoc = await loadFile(binFile);

    if (!tsDoc) throw new Error("Expected loadFile to return a Document for .ts file");
    if (!mdDoc) throw new Error("Expected loadFile to return a Document for .md file");
    if (binDoc !== null) throw new Error("Expected loadFile to return null for .png file");
    if (!tsDoc.content.includes("validateToken")) throw new Error("Document content incorrect");
    if (tsDoc.metadata?.extension !== ".ts") throw new Error("Metadata extension incorrect");

    console.log(`       Loaded .ts: ${tsDoc.source.split(/[\\/]/).pop()}`);
    console.log(`       Loaded .md: ${mdDoc.source.split(/[\\/]/).pop()}`);
    console.log(`       Skipped .png: null (unsupported)`);
    console.log(`${PASS} Test 1: Document loading — loadFile`);
    passed++;

    await rm(tmpDir, { recursive: true, force: true });
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: Document Loading — loadDirectory ───────────────────────────────
  try {
    console.log("\nTest 2: Document loading — loadDirectory...");

    const tmpDir = join(tmpdir(), `aegis-rag-dir-test-${Date.now()}`);
    await mkdir(join(tmpDir, "src"), { recursive: true });
    await mkdir(join(tmpDir, "node_modules", "pkg"), { recursive: true });

    await writeFile(join(tmpDir, "src", "auth.ts"), "export const auth = () => {};");
    await writeFile(join(tmpDir, "src", "readme.md"), "# Source");
    await writeFile(join(tmpDir, "node_modules", "pkg", "index.ts"), "// should be excluded");

    const docs = await loadDirectory(tmpDir);

    if (docs.length !== 2) throw new Error(`Expected 2 documents, got ${docs.length}`);
    if (docs.some((d) => d.source.includes("node_modules"))) {
      throw new Error("node_modules should be excluded");
    }

    console.log(`       Loaded ${docs.length} documents (node_modules excluded)`);
    console.log(`${PASS} Test 2: Directory loading with exclusion`);
    passed++;

    await rm(tmpDir, { recursive: true, force: true });
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 3: Chunking — single document ────────────────────────────────────
  try {
    console.log("\nTest 3: Chunking — single document...");

    const doc: Document = {
      source: "test/auth.ts",
      content: "A".repeat(3000), // 3000 chars, clearly needs multiple chunks
    };

    const chunks = chunkDocument(doc, { chunkSize: 1000, overlap: 100 });

    if (chunks.length < 2) throw new Error(`Expected multiple chunks, got ${chunks.length}`);
    if (chunks[0]?.chunkIndex !== 0) throw new Error("First chunk index should be 0");
    if (chunks[0]?.source !== "test/auth.ts") throw new Error("Source not propagated");
    if (chunks[0]?.totalChunks !== chunks.length) throw new Error("totalChunks mismatch");
    if (!chunks[0]?.id.includes("chunk:")) throw new Error("ID format incorrect");

    console.log(`       Input: 3000 chars → ${chunks.length} chunks (size=1000, overlap=100)`);
    console.log(`       First chunk ID: ${chunks[0]?.id}`);
    console.log(`${PASS} Test 3: Chunking — correct chunk count, ID, and metadata`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 3: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 4: Chunking — short document (single chunk) ──────────────────────
  try {
    console.log("\nTest 4: Chunking — short document fits in single chunk...");

    const doc: Document = { source: "tiny.md", content: "Short doc." };
    const chunks = chunkDocument(doc, { chunkSize: 1000 });

    if (chunks.length !== 1) throw new Error(`Expected 1 chunk, got ${chunks.length}`);
    if (chunks[0]?.totalChunks !== 1) throw new Error("totalChunks should be 1");
    if (chunks[0]?.content !== "Short doc.") throw new Error("Content mismatch");

    console.log(`       1 short document → 1 chunk`);
    console.log(`${PASS} Test 4: Short document → single chunk`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 4: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 5: Vector Store — add and search ─────────────────────────────────
  try {
    console.log("\nTest 5: Vector store — add chunks and search by cosine similarity...");

    const mockChunk = (id: string, content: string): Chunk => ({
      id,
      content,
      source: "test.ts",
      chunkIndex: 0,
      totalChunks: 1,
    });

    const store = new InMemoryVectorStore();

    // Synthetic embeddings: [1,0,0] and [0,1,0] are orthogonal, [0.9,0.1,0] is close to first
    await store.add([
      { chunk: mockChunk("c1", "JWT token validation"), embedding: [1, 0, 0] },
      { chunk: mockChunk("c2", "database schema migration"), embedding: [0, 1, 0] },
      { chunk: mockChunk("c3", "token auth similar"), embedding: [0.9, 0.1, 0] },
    ]);

    if (store.size() !== 3) throw new Error(`Expected 3 stored chunks, got ${store.size()}`);

    // Query embedding close to c1 and c3
    const results = await store.search([1, 0, 0], { topK: 2 });

    if (results.length !== 2) throw new Error(`Expected 2 results, got ${results.length}`);
    if (results[0]?.chunk.id !== "c1") throw new Error(`Expected c1 first, got ${results[0]?.chunk.id}`);
    if (results[0]!.score <= results[1]!.score) throw new Error("Results not sorted by score");

    console.log(`       Stored 3 chunks. Query [1,0,0] → top result: "${results[0]?.chunk.content}" (score: ${results[0]?.score.toFixed(3)})`);
    console.log(`${PASS} Test 5: Vector store add + cosine similarity search`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 5: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 6: Retriever ─────────────────────────────────────────────────────
  try {
    console.log("\nTest 6: Retriever — retrieve with mock embedder...");

    const mockEmbedder = createMockEmbedder(16);
    const store = new InMemoryVectorStore();
    const retriever = new Retriever(mockEmbedder, store);

    const mockChunk = (id: string, content: string): Chunk => ({
      id, content, source: "src/auth.ts", chunkIndex: 0, totalChunks: 1,
    });

    // Pre-embed and store some chunks directly
    const texts = [
      "JWT token validation with bcrypt password hashing",
      "database migration script for PostgreSQL",
      "React component rendering lifecycle hooks",
    ];

    const embeddings = await mockEmbedder.embedBatch(texts);
    await store.add(texts.map((content, i) => ({
      chunk: mockChunk(`c${i}`, content),
      embedding: embeddings[i]!,
    })));

    const results = await retriever.retrieve("JWT authentication token", { topK: 2 });

    if (results.length === 0) throw new Error("Expected at least 1 result");
    if (results.length > 2) throw new Error("topK=2 exceeded");

    const contextStr = await retriever.retrieveContext("JWT authentication token", 2);
    if (!contextStr.includes("--- Context 1")) throw new Error("Context format incorrect");

    console.log(`       Query: "JWT authentication token" → ${results.length} results`);
    console.log(`       Top result: "${results[0]?.chunk.content?.slice(0, 50)}..."`);
    console.log(`${PASS} Test 6: Retriever with mock embedder`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 6: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 7: Full pipeline — ingestText → retrieve (no live API) ────────────
  try {
    console.log("\nTest 7: Full pipeline — ingestText → retrieve (mock embedder, no API)...");

    const mockEmbedder = createMockEmbedder(16);
    const store = new InMemoryVectorStore();
    const pipeline = new RagPipeline({ embedder: mockEmbedder, vectorStore: store });

    const count1 = await pipeline.ingestText(
      "JWT authentication uses signed tokens. The server validates the signature on each request.",
      "docs/auth.md"
    );
    const count2 = await pipeline.ingestText(
      "PostgreSQL migrations use sequential numbered SQL files. Run them in order.",
      "docs/db.md"
    );

    if (pipeline.chunkCount !== count1 + count2) {
      throw new Error(`chunkCount mismatch: ${pipeline.chunkCount} vs ${count1 + count2}`);
    }

    const results = await pipeline.retrieve("JWT token validation", 2);
    if (results.length === 0) throw new Error("Expected at least 1 result");

    const content = await pipeline.retrieveContent("JWT token validation", 1);
    if (content.length !== 1) throw new Error("Expected 1 content string");

    pipeline.clear();
    if (pipeline.chunkCount !== 0) throw new Error("clear() did not empty store");

    console.log(`       Ingested ${count1 + count2} chunks from 2 sources`);
    console.log(`       Query result: "${results[0]?.chunk.content.slice(0, 60)}..."`);
    console.log(`       clear() → chunkCount = 0`);
    console.log(`${PASS} Test 7: Full pipeline ingest → retrieve → clear`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 7: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 8: Edge cases ─────────────────────────────────────────────────────
  try {
    console.log("\nTest 8: Edge cases — empty query, empty store, empty chunk input...");

    const mockEmbedder = createMockEmbedder(8);
    const store = new InMemoryVectorStore();
    const retriever = new Retriever(mockEmbedder, store);

    // Empty query → no results
    const emptyResults = await retriever.retrieve("", { topK: 5 });
    if (emptyResults.length !== 0) throw new Error("Empty query should return 0 results");

    // Empty store → no results
    const noStoreResults = await retriever.retrieve("JWT token", { topK: 5 });
    if (noStoreResults.length !== 0) throw new Error("Empty store should return 0 results");

    // Empty document → no chunks
    const emptyDoc: Document = { source: "empty.ts", content: "" };
    const emptyChunks = chunkDocument(emptyDoc, { chunkSize: 500 });
    if (emptyChunks.length !== 0) throw new Error("Empty document should produce 0 chunks");

    // chunkDocuments([]) → []
    const noChunks = chunkDocuments([], {});
    if (noChunks.length !== 0) throw new Error("No documents should produce 0 chunks");

    console.log(`       Empty query → 0 results ✓`);
    console.log(`       Empty store → 0 results ✓`);
    console.log(`       Empty document → 0 chunks ✓`);
    console.log(`       chunkDocuments([]) → 0 chunks ✓`);
    console.log(`${PASS} Test 8: Edge cases handled correctly`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 8: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 9: LIVE — Gemini Embedding API (isolated, requires GOOGLE_API_KEY) ─
  const hasApiKey = !!process.env["GOOGLE_API_KEY"];

  if (!hasApiKey) {
    console.log("\n⚠️  Test 9: SKIPPED — GOOGLE_API_KEY not set (live embedding test)");
  } else {
    try {
      console.log("\nTest 9: LIVE — Gemini embedding API (gemini-embedding-001)...");
      const { GeminiEmbedder } = await import("./embeddings/geminiEmbedder.js");
      const embedder = new GeminiEmbedder();

      const vec = await embedder.embed("how does JWT authentication work?");

      if (!Array.isArray(vec) || vec.length < 100) {
        throw new Error(`Expected high-dim vector, got length ${vec.length}`);
      }
      if (!vec.every((v) => typeof v === "number")) {
        throw new Error("Embedding contains non-numeric values");
      }

      console.log(`       Embedding dimension: ${vec.length}`);
      console.log(`       Sample values: [${vec.slice(0, 4).map((v) => v.toFixed(4)).join(", ")}, ...]`);
      console.log(`${PASS} Test 9: Live Gemini embedding API (dimension ${vec.length})`);
      passed++;
    } catch (err) {
      console.log(`${FAIL} Test 9 (live): ${(err as Error).message}`);
      failed++;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const total = hasApiKey ? 9 : 8;
  console.log(`\n=== Results: ${passed} passed, ${failed} failed (of ${total} run) ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
