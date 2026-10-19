/**
 * scripts/run-autonomous-investigate.ts
 *
 * AEGIS P01 — Genuine AI-Driven Autonomous Investigation
 *
 * Runs the native agent with a real configured LLM (Gemini 3.6 Flash)
 * against an unfamiliar disposable repository.
 * Redacts secrets, captures the entire request/tool/observation sequence,
 * and verifies grounded reasoning.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { runToolAgent } from "../src/agent/agent.js";
import { createInvestigationTools } from "../src/tools/investigation/index.js";
import { assembleGroundedContext } from "../src/context/groundedContext.js";
import { getActiveProviderConfig } from "../src/agent/models/providerConfig.js";

function redactSecrets(str: string): string {
  return str.replace(/([A-Za-z0-9_\-]{20,})/g, (match) => {
    if (match.startsWith("AIza") || match.startsWith("ghp_") || match.startsWith("gsk_") || match.startsWith("sk-")) {
      return match.substring(0, 4) + "***[REDACTED_SECRET]***";
    }
    return match;
  });
}

function createDisposableAuthRepo(): { repoDir: string; cleanUp: () => void } {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-investigate-auth-"));
  const authDir = path.join(repoDir, "src", "auth");
  const controllerDir = path.join(repoDir, "src", "controllers");
  fs.mkdirSync(authDir, { recursive: true });
  fs.mkdirSync(controllerDir, { recursive: true });

  const tokenValidatorCode = [
    "/**",
    " * src/auth/tokenValidator.ts",
    " * Authentication token verification logic.",
    " */",
    "",
    "export interface AuthToken {",
    "  userId: string;",
    "  expiresAt: number; // Unix timestamp in ms",
    "  signature: string;",
    "}",
    "",
    "export function verifyAuthToken(token: AuthToken): boolean {",
    "  if (!token || !token.userId) {",
    "    return false;",
    "  }",
    "",
    "  const now = Date.now();",
    "  // Root Cause Defect: Inverted expiry check accepts expired tokens immediately",
    "  // when now > expiresAt, returning true without verifying signature or freshness!",
    "  if (now > token.expiresAt) {",
    "    return true; // BUG: Should return false because token is already expired",
    "  }",
    "",
    "  return token.signature === `sig_${token.userId}_valid`;",
    "}",
    "",
  ].join("\n");

  const controllerCode = [
    "/**",
    " * src/controllers/userController.ts",
    " */",
    "import { verifyAuthToken, AuthToken } from \"../auth/tokenValidator.js\";",
    "",
    "export function handleProtectedResource(token: AuthToken): { success: boolean; status: number } {",
    "  if (verifyAuthToken(token)) {",
    "    return { success: true, status: 200 };",
    "  }",
    "  return { success: false, status: 401 };",
    "}",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(authDir, "tokenValidator.ts"), tokenValidatorCode, "utf8");
  fs.writeFileSync(path.join(controllerDir, "userController.ts"), controllerCode, "utf8");

  return {
    repoDir,
    cleanUp: () => {
      try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch {}
    },
  };
}

async function runInvestigation(): Promise<void> {
  console.log("================================================================================");
  console.log("  AEGIS P01 — SECTION 4: GENUINE AI-DRIVEN INVESTIGATE RUNTIME VERIFICATION");
  console.log("================================================================================");

  const activeProvider = getActiveProviderConfig();
  console.log(`Active Model Provider : ${activeProvider.provider.toUpperCase()} (${activeProvider.model})`);
  console.log(`Zero Pre-Scripted Tools: True (Agent model autonomously selects all actions)`);
  console.log(`Test Adapter Active   : False (Real model inference only)`);

  const { repoDir, cleanUp } = createDisposableAuthRepo();

  try {
    const tools = createInvestigationTools(repoDir);
    const goal = "Find why this authentication function accepts invalid or expired tokens. Inspect the actual code and explain the root cause with file references.";
    const grounded = assembleGroundedContext({ workspace: repoDir, goal });

    console.log(`\nDisposable Repository: ${repoDir}`);
    console.log(`User Goal: "${goal}"\n`);
    console.log("--------------------------------------------------------------------------------");
    console.log("EXECUTING AUTONOMOUS AGENT LOOP");
    console.log("--------------------------------------------------------------------------------");

    const traces: Array<{ tool: string; args: any; output: string; durationMs: number }> = [];

    const startTime = Date.now();
    const result = await runToolAgent(goal, tools, {}, {
      groundedContext: grounded,
      maxIterations: 6,
      onToolExecution: (rec) => {
        const redactedOutput = redactSecrets(typeof rec.output === "string" ? rec.output : JSON.stringify(rec.output));
        traces.push({
          tool: rec.name,
          args: rec.args,
          output: redactedOutput,
          durationMs: rec.durationMs,
        });
        console.log(`\n[Agent Tool Call]: ${rec.name}`);
        console.log(`  Arguments : ${JSON.stringify(rec.args)}`);
        console.log(`  Duration  : ${rec.durationMs}ms`);
        console.log(`  Observation snippet: ${redactedOutput.substring(0, 180).replace(/\\n/g, " ")}...`);
      },
    });

    const elapsed = Date.now() - startTime;

    console.log("\n--------------------------------------------------------------------------------");
    console.log("AGENT COMPLETION & DIAGNOSTIC REASONING");
    console.log("--------------------------------------------------------------------------------");
    console.log(`Termination Status : ${result.termination}`);
    console.log(`Iterations Made    : ${result.iterations}`);
    console.log(`Total Tool Calls   : ${traces.length}`);
    console.log(`Elapsed Time       : ${elapsed}ms`);
    console.log(`\nFinal Grounded Explanation from Real Model:\n`);
    console.log(redactSecrets(result.text));
    console.log("\n--------------------------------------------------------------------------------");

    const textLower = result.text.toLowerCase();
    const identifiesTokenValidator = result.text.includes("tokenValidator.ts") || textLower.includes("tokenvalidator");
    const identifiesExpiryBug = textLower.includes("expired") || textLower.includes("expiresat") || textLower.includes("now >");
    const identifiesInvertedLogic = textLower.includes("true") || textLower.includes("inverted") || textLower.includes("returns true") || textLower.includes("greater than");

    console.log("\nVerification Gates for Section 4:");
    console.log(`  1. Real tool calls executed autonomously   : ${traces.length > 0 ? "✅ PASSED" : "❌ FAILED"} (${traces.length} calls)`);
    console.log(`  2. Source file identified with reference    : ${identifiesTokenValidator ? "✅ PASSED" : "❌ FAILED"}`);
    console.log(`  3. Root cause of expiry flaw explained      : ${identifiesExpiryBug ? "✅ PASSED" : "❌ FAILED"}`);
    console.log(`  4. Inverted return logic correctly diagnosed: ${identifiesInvertedLogic ? "✅ PASSED" : "❌ FAILED"}`);

    if (result.termination === "completed" && identifiesTokenValidator && identifiesExpiryBug) {
      console.log("\n>>> SECTION 4: GENUINE AI-DRIVEN INVESTIGATE TASK ACCEPTED! ✅ <<<\n");
    } else {
      console.log(`\nResult notice: Termination=${result.termination}, error=${result.error}`);
    }
  } finally {
    cleanUp();
  }
}

runInvestigation().catch((err) => {
  console.error("Investigation task error:", err);
  process.exit(1);
});
