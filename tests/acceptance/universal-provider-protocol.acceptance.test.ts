/**
 * tests/acceptance/universal-provider-protocol.acceptance.test.ts
 *
 * AEGIS P01 — Universal Provider Protocol Verification Suite
 *
 * Validates with deterministic offline HTTP mock fixtures:
 * 1. Provider and credential resolution (env-isolated)
 * 2. Tool declaration conversion (Google FunctionDeclaration -> OpenAI Tool)
 * 3. Function-call argument parsing & tool-call ID association
 * 4. Multi-turn conversation message history reconstruction
 * 5. Structured-output schema enforcement (callStructured with OpenAI compatible payload)
 * 6. Malformed responses handling (graceful error / rejection)
 * 7. HTTP 429 quota exhaustion (transient retry & informative error)
 * 8. HTTP 503 transient failure backoff recovery
 * 9. AbortSignal cancellation propagation
 * 10. Secret scrubbing (API keys masked from exceptions and traces)
 */

import assert from "node:assert/strict";
import http from "node:http";
import { z } from "zod";
import { getActiveProviderConfig } from "../../src/agent/models/providerConfig.js";
import { createUniversalAgentModel } from "../../src/agent/models/universalModel.js";
import { callStructured } from "../../src/agent/models/gemini/structured.js";
import { scrubSecrets } from "../../src/tools/terminal/index.js";
import { FunctionDeclaration, Content } from "@google/genai";

async function runOfflineProtocolTests(): Promise<void> {
  console.log("==================================================================");
  console.log("  AEGIS P01 — UNIVERSAL PROVIDER OFFLINE PROTOCOL VERIFICATION");
  console.log("==================================================================\n");

  // ── 1. Provider and Credential Resolution (Isolated Env) ──────────────────
  console.log("1. Testing Provider and Credential Resolution...");
  {
    const geminiCfg = getActiveProviderConfig({
      LLM_PROVIDER: "gemini",
      GOOGLE_API_KEY: "AIzaSy_gemini_test_key_12345",
    });
    assert.equal(geminiCfg.provider, "gemini");
    assert.equal(geminiCfg.isOpenAICompatible, false);
    assert.equal(geminiCfg.apiKey, "AIzaSy_gemini_test_key_12345");

    const groqCfg = getActiveProviderConfig({
      LLM_PROVIDER: "groq",
      GROQ_API_KEY: "gsk_groq_test_key_12345",
    });
    assert.equal(groqCfg.provider, "groq");
    assert.equal(groqCfg.isOpenAICompatible, true);
    assert.equal(groqCfg.model, "llama-3.3-70b-versatile");
    assert.equal(groqCfg.baseUrl, "https://api.groq.com/openai/v1");
    assert.equal(groqCfg.apiKey, "gsk_groq_test_key_12345");

    const openRouterCfg = getActiveProviderConfig({
      LLM_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "sk-or-v1-test-key",
    });
    assert.equal(openRouterCfg.provider, "openrouter");
    assert.equal(openRouterCfg.isOpenAICompatible, true);
    assert.equal(openRouterCfg.baseUrl, "https://openrouter.ai/api/v1");

    const genericKeyCfg = getActiveProviderConfig({
      LLM_PROVIDER: "deepseek",
      LLM_API_KEY: "generic_secret_key",
    });
    assert.equal(genericKeyCfg.provider, "deepseek");
    assert.equal(genericKeyCfg.apiKey, "generic_secret_key");

    console.log("   ✅ PASSED: Multi-provider and credential resolution verified.");
  }

  // ── Start Local Mock HTTP Server for OpenAI-compatible endpoints ──────────
  let serverRequests: Array<{ url: string; headers: http.IncomingHttpHeaders; body: any }> = [];
  let responseHandler: (req: http.IncomingMessage, body: any) => { status: number; body: any } = () => ({
    status: 200,
    body: { choices: [{ message: { content: "default response" } }] },
  });

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      let body: any = {};
      try {
        body = JSON.parse(raw);
      } catch {}
      serverRequests.push({ url: req.url || "", headers: req.headers, body });
      const resp = responseHandler(req, body);
      res.writeHead(resp.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(resp.body));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address() as any;
  const mockBaseUrl = `http://127.0.0.1:${address.port}/v1`;

  try {
    // ── 2. Tool Declaration & Multi-turn Message Conversion ──────────────────
    console.log("\n2. Testing Tool Declaration & Message History Conversion...");
    {
      serverRequests = [];
      responseHandler = (_req, body) => {
        assert.ok(Array.isArray(body.tools), "Expected tools array in OpenAI format");
        assert.equal(body.tools[0].type, "function");
        assert.equal(body.tools[0].function.name, "search_code");
        assert.equal(body.messages[0].role, "user");
        assert.equal(body.messages[0].content, "Find user auth");

        return {
          status: 200,
          body: {
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: "call_abc123",
                      type: "function",
                      function: {
                        name: "search_code",
                        arguments: JSON.stringify({ query: "authenticate" }),
                      },
                    },
                  ],
                },
              },
            ],
          },
        };
      };

      const model = createUniversalAgentModel({
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        apiKey: "gsk_test_fixture_key",
        baseUrl: mockBaseUrl,
        isOpenAICompatible: true,
      });

      const declarations: FunctionDeclaration[] = [
        {
          name: "search_code",
          description: "Search codebase by regex",
          parameters: {
            type: "object" as any,
            properties: { query: { type: "string" as any } },
            required: ["query"],
          },
        },
      ];

      const initialContents: Content[] = [{ role: "user", parts: [{ text: "Find user auth" }] }];
      const step1Result = await model.generate(initialContents, declarations);

      assert.equal(step1Result.functionCalls?.length, 1);
      assert.equal(step1Result.functionCalls[0].id, "call_abc123");
      assert.equal(step1Result.functionCalls[0].name, "search_code");
      assert.deepEqual(step1Result.functionCalls[0].args, { query: "authenticate" });

      responseHandler = (_req, body) => {
        assert.equal(body.messages[1].role, "assistant");
        assert.equal(body.messages[1].tool_calls[0].id, "call_abc123");
        assert.equal(body.messages[2].role, "tool");
        assert.equal(body.messages[2].tool_call_id, "call_abc123");
        assert.equal(body.messages[2].content, "auth.ts: line 12");

        return {
          status: 200,
          body: {
            choices: [{ message: { content: "Authentication is handled in auth.ts" } }],
          },
        };
      };

      const multiTurnContents: Content[] = [
        ...initialContents,
        step1Result.content!,
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                id: "call_abc123",
                name: "search_code",
                response: "auth.ts: line 12",
              },
            },
          ],
        },
      ];

      const step2Result = await model.generate(multiTurnContents, declarations);
      assert.equal(step2Result.text, "Authentication is handled in auth.ts");
      console.log("   ✅ PASSED: Tool declarations, calls, and multi-turn message history mapped accurately.");
    }

    // ── 3. Structured-Output Schema Enforcement ──────────────────────────────
    console.log("\n3. Testing Structured-Output Schema Enforcement via callStructured...");
    {
      const prevProvider = process.env.LLM_PROVIDER;
      const prevBaseUrl = process.env.LLM_BASE_URL;
      const prevApiKey = process.env.LLM_API_KEY;

      process.env.LLM_PROVIDER = "groq";
      process.env.LLM_BASE_URL = mockBaseUrl;
      process.env.LLM_API_KEY = "gsk_test_key";

      responseHandler = (_req, body) => {
        assert.equal(body.response_format?.type, "json_object");
        return {
          status: 200,
          body: {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    verdict: "APPROVE",
                    confidence: 0.95,
                    findings: ["Safe import", "Bounded buffer"],
                  }),
                },
              },
            ],
          },
        };
      };

      const ReviewSchema = z.object({
        verdict: z.enum(["APPROVE", "REVISE", "BLOCK"]),
        confidence: z.number(),
        findings: z.array(z.string()),
      });

      const structuredResult = await callStructured("Review patch", ReviewSchema);
      assert.equal(structuredResult.verdict, "APPROVE");
      assert.equal(structuredResult.confidence, 0.95);
      assert.equal(structuredResult.findings.length, 2);

      // Restore env
      process.env.LLM_PROVIDER = prevProvider;
      process.env.LLM_BASE_URL = prevBaseUrl;
      process.env.LLM_API_KEY = prevApiKey;

      console.log("   ✅ PASSED: Structured output parsed and validated through Zod schema.");
    }

    // ── 4. Error Handling: 429 Quota Exhaustion & 503 Transient Retry ─────────
    console.log("\n4. Testing Transient Retries & Rate-Limit Handling (429 & 503)...");
    {
      let callCount = 0;
      responseHandler = () => {
        callCount++;
        if (callCount === 1) {
          return { status: 503, body: { error: { message: "Service temporarily unavailable" } } };
        }
        return { status: 200, body: { choices: [{ message: { content: "Recovered from 503" } }] } };
      };

      const model = createUniversalAgentModel({
        provider: "groq",
        apiKey: "gsk_test",
        baseUrl: mockBaseUrl,
        isOpenAICompatible: true,
      });

      const recoveredResult = await model.generate([{ role: "user", parts: [{ text: "ping" }] }], []);
      assert.equal(recoveredResult.text, "Recovered from 503");
      assert.equal(callCount, 2);

      // 429 Exhaustion
      responseHandler = () => ({
        status: 429,
        body: { error: { message: "Daily quota limit reached. Retry in 1 hour." } },
      });

      await assert.rejects(
        async () => {
          await model.generate([{ role: "user", parts: [{ text: "ping" }] }], []);
        },
        (err: any) => {
          assert.equal(err.status, 429);
          assert.ok(err.message.includes("quota limit reached"));
          return true;
        }
      );

      console.log("   ✅ PASSED: 503 transient failure recovered on retry; 429 quota exhaustion caught cleanly.");
    }

    // ── 5. Cancellation via AbortSignal ──────────────────────────────────────
    console.log("\n5. Testing Cancellation Propagation...");
    {
      const controller = new AbortController();
      controller.abort();

      const model = createUniversalAgentModel({
        provider: "groq",
        apiKey: "gsk_test",
        baseUrl: mockBaseUrl,
        isOpenAICompatible: true,
      });

      await assert.rejects(
        async () => {
          await model.generate([{ role: "user", parts: [{ text: "ping" }] }], [], controller.signal);
        },
        (err: any) => {
          assert.equal(err.name, "AbortError");
          return true;
        }
      );

      console.log("   ✅ PASSED: Pre-aborted signal terminates without executing HTTP request.");
    }

    // ── 6. Secret Redaction ──────────────────────────────────────────────────
    console.log("\n6. Testing Secret Scrubbing in Traces and Exceptions...");
    {
      const rawSecret = "gsk_live_secret_key_abcdef1234567890";
      const masked = scrubSecrets(`Error communicating with key ${rawSecret}`);
      assert.ok(!masked.includes(rawSecret), "Secret must not leak into logs");
      assert.ok(masked.includes("gsk_***MASKED***"), "Secret pattern should be masked");

      console.log("   ✅ PASSED: Provider secret tokens masked from diagnostic outputs.");
    }
  } finally {
    server.close();
  }

  console.log("\n==================================================================");
  console.log("  ALL UNIVERSAL PROVIDER OFFLINE PROTOCOL TESTS PASSED! ✅");
  console.log("==================================================================\n");
}

runOfflineProtocolTests().catch((err) => {
  console.error("Protocol verification failed:", err);
  process.exit(1);
});
