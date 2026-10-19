import fs from "fs";
import os from "os";
import path from "path";
import assert from "node:assert/strict";
import { Content, FunctionDeclaration } from "@google/genai";
import { runToolAgent, AgentModel } from "./agent.js";
import { createInvestigationTools, validateSourceEvidence } from "../tools/investigation/index.js";

function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-agent-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "auth.ts"), "export function authenticate() { return true; }\n");
  return root;
}

async function main(): Promise<void> {
  const workspace = fixture();
  let calls = 0;
  let continuity = false;
  const model: AgentModel = {
    model: "deterministic-test",
    async generate(contents: Content[], _declarations: FunctionDeclaration[]) {
      calls++;
      continuity ||= contents.some((content) =>
        content.parts?.some((part) => Boolean(part.functionResponse))
      );
      if (calls === 1) {
        return {
          functionCalls: [
            { id: "a", name: "discover_files", args: {} },
            { id: "b", name: "search_repository", args: { query: "authenticate" } },
          ],
        };
      }
      if (calls === 2) {
        return {
          functionCalls: [{ id: "c", name: "read_source_file", args: { path: "src/auth.ts" } }],
        };
      }
      return { text: "Authentication is implemented by authenticate." };
    },
  };

  const result = await runToolAgent(
    "Where is authentication handled?",
    createInvestigationTools(workspace),
    {},
    { model, maxIterations: 4, maxToolCalls: 5 }
  );
  assert.equal(result.termination, "completed");
  assert.equal(result.toolCallsExecuted.length, 3);
  assert.equal(result.toolCallsExecuted[1].name, "search_repository");
  assert.equal(continuity, true);

  let protocolVerified = false;
  await runToolAgent("protocol", createInvestigationTools(workspace), {}, {
    model: {
      model: "gemini-protocol-test",
      async generate(contents) {
        if (contents.length === 1) {
          return {
            content: {
              role: "model",
              parts: [{ functionCall: { id: "provider-id", name: "discover_files", args: {} } }],
            },
            functionCalls: [{ id: "provider-id", name: "discover_files", args: {} }],
          };
        }
        const modelPart = contents[1].parts?.[0];
        const responsePart = contents[2]?.parts?.[0];
        protocolVerified = modelPart?.functionCall?.id === "provider-id"
          && responsePart?.functionResponse?.id === "provider-id";
        return { text: "protocol complete" };
      },
    },
    maxIterations: 2,
  });
  assert.equal(protocolVerified, true);

  const validEvidence = validateSourceEvidence(workspace, [{
    path: "src/auth.ts",
    line: 1,
    reason: "fixture",
    observedText: "authenticate",
  }]);
  assert.equal(validEvidence.valid.length, 1);
  const invalidEvidence = validateSourceEvidence(workspace, [{
    path: "../outside.ts",
    line: 1,
    reason: "fabricated",
  }, {
    path: "src/auth.ts",
    line: 99,
    reason: "invalid line",
  }]);
  assert.equal(invalidEvidence.invalid.length, 2);

  const malformed = await runToolAgent(
    "Read a file",
    createInvestigationTools(workspace),
    {},
    {
      model: {
        model: "malformed-test",
        async generate() {
          return { functionCalls: [{ name: "read_source_file", args: { path: "../secret" } }] };
        },
      },
      maxIterations: 1,
    }
  );
  assert.equal(malformed.toolCallsExecuted[0].policyDecision, "BLOCK");
  assert.match(malformed.toolCallsExecuted[0].error ?? "", /Path escape attempt blocked/);

  await assert.rejects(
    () => runToolAgent("unknown", createInvestigationTools(workspace), {}, {
      model: {
        model: "unknown-test",
        async generate() {
          return { functionCalls: [{ name: "does_not_exist", args: {} }] };
        },
      },
    }),
    /unknown tool/
  );

  const limited = await runToolAgent("limit", createInvestigationTools(workspace), {}, {
    model: {
      model: "limit-test",
      async generate() {
        return { functionCalls: [{ name: "discover_files", args: {} }] };
      },
    },
    maxIterations: 2,
    maxToolCalls: 1,
  });
  assert.equal(limited.termination, "tool_call_limit");

  const iterationLimited = await runToolAgent("iteration limit", createInvestigationTools(workspace), {}, {
    model: {
      model: "iteration-limit-test",
      async generate() {
        return { functionCalls: [{ name: "discover_files", args: {} }] };
      },
    },
    maxIterations: 2,
    maxToolCalls: 10,
  });
  assert.equal(iterationLimited.termination, "iteration_limit");

  await assert.rejects(
    () => runToolAgent("model failure", createInvestigationTools(workspace), {}, {
      model: {
        model: "failure-test",
        async generate() {
          throw new Error("model unavailable");
        },
      },
    }),
    /model unavailable/
  );

  await assert.rejects(
    () => runToolAgent("malformed provider response", createInvestigationTools(workspace), {}, {
      model: {
        model: "malformed-provider-test",
        async generate() {
          return { functionCalls: [{ args: {} }] };
        },
      },
    }),
    /malformed tool call/
  );

  await assert.rejects(
    () => runToolAgent("model timeout", createInvestigationTools(workspace), {}, {
      model: {
        model: "timeout-test",
        async generate() {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { text: "late" };
        },
      },
      timeoutMs: 5,
    }),
    /timed out/
  );

  console.log("Native agent tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
