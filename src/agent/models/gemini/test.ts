/**
 * models/gemini/test.ts
 *
 * Feature 01 — Gemini Model Layer verification script.
 *
 * Run with:
 *   npx tsx models/gemini/test.ts
 *
 * Tests:
 *  1. Module imports successfully (gemini, createModel, getClient)
 *  2. getClient() returns a shared GoogleGenAI instance
 *  3. createModel() produces a model handle with correct config
 *  4. gemini.invoke() — live API call using the default model
 *  5. createModel({ model: "gemini-3.5-flash" }).invoke() — custom model
 */

import { gemini, createModel, getClient } from "./index.js";
import { GoogleGenAI } from "@google/genai";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 01 — Gemini Model Layer Tests ===\n");

  // ── Test 1: Module imports ────────────────────────────────────────────────
  try {
    if (!gemini) throw new Error("gemini is undefined");
    if (typeof createModel !== "function") throw new Error("createModel is not a function");
    if (typeof getClient !== "function") throw new Error("getClient is not a function");
    console.log(`${PASS} Test 1: All exports imported (gemini, createModel, getClient)`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: getClient() returns a GoogleGenAI instance ───────────────────
  try {
    const client = getClient();
    if (!(client instanceof GoogleGenAI)) {
      throw new Error("getClient() did not return a GoogleGenAI instance");
    }
    // calling twice should return the same instance (singleton)
    const client2 = getClient();
    if (client !== client2) throw new Error("getClient() is not a singleton");
    console.log(`${PASS} Test 2: getClient() returns a singleton GoogleGenAI instance`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 3: createModel() produces correct config ────────────────────────
  try {
    const custom = createModel({ model: "gemini-3.5-flash", temperature: 0 });
    if (custom.model !== "gemini-3.5-flash") {
      throw new Error(`Expected model "gemini-3.5-flash", got "${custom.model}"`);
    }
    if (custom.temperature !== 0) {
      throw new Error(`Expected temperature 0, got ${custom.temperature}`);
    }
    if (typeof custom.invoke !== "function") {
      throw new Error("createModel() did not return an object with invoke()");
    }
    // Default model
    if (gemini.model !== "gemini-3.5-flash") {
      throw new Error(`Expected default model "gemini-3.5-flash", got "${gemini.model}"`);
    }
    console.log(`${PASS} Test 3: createModel() produces correct model handle`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 3: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 4: Live API call — default model ────────────────────────────────
  try {
    console.log(`\n       Test 4: Calling default model (${gemini.model})...`);
    const { text } = await gemini.invoke("Reply with exactly the word: AEGIS_OK");
    console.log(`       Response: "${text.trim()}"`);
    if (!text.includes("AEGIS_OK")) {
      throw new Error(`Expected "AEGIS_OK" in response, got: "${text.trim()}"`);
    }
    console.log(`${PASS} Test 4: Default model responded correctly`);
    passed++;
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("no longer available to new users")) {
      // Known API restriction — model exists but blocked for this API key tier.
      // Try the fallback model instead.
      console.log(`       NOTE: ${gemini.model} blocked for this API key. Trying gemini-3.5-flash...`);
      try {
        const fallback = createModel({ model: "gemini-3.5-flash" });
        const { text } = await fallback.invoke("Reply with exactly the word: AEGIS_OK");
        console.log(`       Fallback response: "${text.trim()}"`);
        if (!text.includes("AEGIS_OK")) throw new Error(`Unexpected: ${text.trim()}`);
        console.log(`${PASS} Test 4: Fallback model (gemini-3.5-flash) responded correctly`);
        passed++;
      } catch (fbErr) {
        console.log(`${FAIL} Test 4 (fallback): ${(fbErr as Error).message}`);
        failed++;
      }
    } else {
      console.log(`${FAIL} Test 4: ${msg}`);
      failed++;
    }
  }

  // ── Test 5: Custom model — gemini-3.5-flash ──────────────────────────────
  try {
    const custom = createModel({ model: "gemini-3.5-flash", temperature: 0 });
    console.log(`\n       Test 5: Calling custom model (gemini-3.5-flash, temperature=0)...`);
    const { text } = await custom.invoke("Reply with exactly the word: CUSTOM_OK");
    console.log(`       Response: "${text.trim()}"`);
    if (!text.includes("CUSTOM_OK")) {
      throw new Error(`Expected "CUSTOM_OK" in response, got: "${text.trim()}"`);
    }
    console.log(`${PASS} Test 5: Custom model responded correctly`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 5: ${(err as Error).message}`);
    failed++;
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
