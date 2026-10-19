import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { runToolAgent, AgentResult, ToolExecutionRecord } from "../src/agent/agent.js";
import { createInvestigationTools } from "../src/tools/investigation/index.js";
import { assembleGroundedContext } from "../src/context/groundedContext.js";
import { createAegisTool, StructuredTool } from "../src/tools/types.js";
import { z } from "zod";
import { getActiveProviderConfig } from "../src/agent/models/providerConfig.js";

const MAX_TASKS = 3;
const MAX_REQUESTS_PER_TASK = 8;
const MAX_TOTAL_REQUESTS = 24;

interface TaskMetrics {
  taskName: string;
  category: "investigation" | "retrieval_recovery" | "bug_fix_proposal";
  success: boolean;
  termination: string;
  iterations: number;
  toolCallsCount: number;
  latenciesMs: number[];
  p50LatencyMs: number;
  p95LatencyMs: number;
  elapsedMs: number;
  tokensEstimated: { prompt: number; completion: number; total: number };
  costEstimateUsd: number;
  evidence: string[];
  humanApprovalGranted?: boolean;
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function createInvestigationFixture(): { fixtureDir: string; cleanUp: () => void } {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-live-eval-inv-"));
  const srcDir = path.join(fixtureDir, "src", "gateway");
  fs.mkdirSync(srcDir, { recursive: true });

  const code = [
    "export interface RateLimitPolicy {",
    "  maxRequests: number;",
    "  windowSeconds: number;",
    "}",
    "",
    "export class TokenBucketLimiter {",
    "  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();",
    "",
    "  constructor(private readonly policy: RateLimitPolicy) {}",
    "",
    "  public tryConsume(clientId: string, cost = 1): boolean {",
    "    const now = Date.now();",
    "    let bucket = this.buckets.get(clientId);",
    "    if (!bucket) {",
    "      bucket = { tokens: this.policy.maxRequests, lastRefill: now };",
    "      this.buckets.set(clientId, bucket);",
    "    }",
    "    const elapsedSec = (now - bucket.lastRefill) / 1000;",
    "    const refill = elapsedSec * (this.policy.maxRequests / this.policy.windowSeconds);",
    "    bucket.tokens = Math.min(this.policy.maxRequests, bucket.tokens + refill);",
    "    bucket.lastRefill = now;",
    "",
    "    if (bucket.tokens >= cost) {",
    "      bucket.tokens -= cost;",
    "      return true;",
    "    }",
    "    return false;",
    "  }",
    "}",
  ].join("\n");

  fs.writeFileSync(path.join(srcDir, "tokenBucket.ts"), code, "utf8");
  return {
    fixtureDir,
    cleanUp: () => {
      try { fs.rmSync(fixtureDir, { recursive: true, force: true }); } catch {}
    },
  };
}

function createRetrievalRecoveryFixture(): { fixtureDir: string; cleanUp: () => void } {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-live-eval-rec-"));
  const legacyDir = path.join(fixtureDir, "packages", "legacy-auth");
  const coreDir = path.join(fixtureDir, "packages", "core-auth");
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.mkdirSync(coreDir, { recursive: true });

  fs.writeFileSync(
    path.join(legacyDir, "deprecatedJwt.ts"),
    "// DEPRECATED: Do not use. Replaced by core-auth/sessionValidator.ts\nexport function verifyLegacy() { return false; }",
    "utf8"
  );

  fs.writeFileSync(
    path.join(coreDir, "sessionValidator.ts"),
    [
      "export interface SessionClaims { sub: string; roles: string[]; exp: number; }",
      "export function validateSessionClaims(token: string): SessionClaims | null {",
      "  if (!token.startsWith('v2_')) return null;",
      "  return { sub: 'usr_canon', roles: ['admin'], exp: Date.now() + 3600 };",
      "}",
    ].join("\n"),
    "utf8"
  );

  return {
    fixtureDir,
    cleanUp: () => {
      try { fs.rmSync(fixtureDir, { recursive: true, force: true }); } catch {}
    },
  };
}

function createBugFixFixture(): { fixtureDir: string; cleanUp: () => void } {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-live-eval-fix-"));
  const mathDir = path.join(fixtureDir, "src", "math");
  fs.mkdirSync(mathDir, { recursive: true });

  fs.writeFileSync(
    path.join(mathDir, "statistics.ts"),
    [
      "export function computeMedian(numbers: number[]): number {",
      "  if (numbers.length === 0) throw new Error('Cannot compute median of empty array');",
      "  const sorted = [...numbers].sort(); // BUG: default sort converts to strings!",
      "  const mid = Math.floor(sorted.length / 2);",
      "  if (sorted.length % 2 !== 0) {",
      "    return sorted[mid];",
      "  }",
      "  return (sorted[mid - 1] + sorted[mid]) / 2;",
      "}",
    ].join("\n"),
    "utf8"
  );

  return {
    fixtureDir,
    cleanUp: () => {
      try { fs.rmSync(fixtureDir, { recursive: true, force: true }); } catch {}
    },
  };
}

async function requestHumanApproval(description: string): Promise<boolean> {
  if (process.env.AEGIS_AUTO_APPROVE_EVAL === "true") {
    console.log(`[APPROVAL REJECTED]: Automated auto-approval is strictly prohibited by AEGIS rules.`);
    return false;
  }

  if (!process.stdin.isTTY) {
    console.log(`[APPROVAL REQUIRED - Non-interactive]: Human approval cannot be granted without TTY.`);
    return false;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\n⚠️  MUTATION APPROVAL REQUIRED\nProposal: ${description}\nApprove this proposed mutation? (yes/no): `, (ans) => {
      rl.close();
      const approved = ans.trim().toLowerCase() === "yes" || ans.trim().toLowerCase() === "y";
      resolve(approved);
    });
  });
}

async function main() {
  const isAuthorized =
    process.argv.includes("--authorize-live-model") ||
    process.env.AEGIS_AUTHORIZE_LIVE_MODEL === "1";

  if (!isAuthorized) {
    console.log("================================================================================");
    console.log("  AEGIS P01 — HELD-OUT LIVE-MODEL AUTONOMOUS REASONING ACCEPTANCE HARNESS");
    console.log("================================================================================");
    console.log("🛡️  SAFETY GATE ACTIVE: Paid/live model calls are currently NOT authorized.");
    console.log("Per AEGIS rules, real model requests will NOT be initiated without explicit authorization.");
    console.log("\nTo authorize execution against the configured Gemini provider, run:");
    console.log("  npx tsx scripts/evaluate-live-model-p01.ts --authorize-live-model\n");
    console.log("Resource Limits Configured:");
    console.log(`  - Maximum tasks           : ${MAX_TASKS}`);
    console.log(`  - Max requests per task   : ${MAX_REQUESTS_PER_TASK}`);
    console.log(`  - Max total requests      : ${MAX_TOTAL_REQUESTS}`);
    console.log(`  - Human approval required : YES (Never auto-approves mutations)`);
    console.log(`  - Sandbox boundary        : CANONICAL (fail-closed, no unsafe host fallback)`);
    console.log("\nStatus: VERIFIED & READY FOR AUTHORIZATION (0 requests executed, $0.00 spent).");
    process.exit(0);
  }

  console.log("================================================================================");
  console.log("  AEGIS P01 — EXECUTING HELD-OUT LIVE-MODEL ACCEPTANCE");
  console.log("================================================================================");
  const activeProvider = getActiveProviderConfig();
  console.log(`Provider: ${activeProvider.provider.toUpperCase()} (${activeProvider.model})`);
  console.log("Safety: Strict limits active. Maximum 24 total model requests.\n");

  const results: TaskMetrics[] = [];
  let totalRequestsAcrossRun = 0;

  // Task 1: Investigation
  console.log("--------------------------------------------------------------------------------");
  console.log("▶ Task 1/3: Autonomous Investigation (TokenBucket rate-limiting logic)");
  console.log("--------------------------------------------------------------------------------");
  const fix1 = createInvestigationFixture();
  try {
    const tools = createInvestigationTools(fix1.fixtureDir);
    const goal = "Investigate the implementation in src/gateway/tokenBucket.ts. Explain under what conditions tryConsume returns false and how refill rate is calculated.";
    const grounded = assembleGroundedContext({ workspace: fix1.fixtureDir, goal });

    const start = Date.now();
    const latencies: number[] = [];
    const agentResult = await runToolAgent(goal, tools, {}, {
      groundedContext: grounded,
      maxIterations: MAX_REQUESTS_PER_TASK,
      onToolExecution: (rec) => {
        latencies.push(rec.durationMs);
        console.log(`  [Tool] ${rec.name} -> ${rec.durationMs}ms`);
      },
    });
    const elapsed = Date.now() - start;
    totalRequestsAcrossRun += agentResult.iterations;

    const success = agentResult.termination === "completed" && agentResult.text.toLowerCase().includes("tokens");
    const p50 = calculatePercentile(latencies, 50);
    const p95 = calculatePercentile(latencies, 95);
    const promptChars = agentResult.promptChars || 2000;
    const completionChars = agentResult.text.length;
    const estPromptTokens = Math.round(promptChars / 4);
    const estCompletionTokens = Math.round(completionChars / 4);
    const cost = (estPromptTokens * 0.00000015) + (estCompletionTokens * 0.0000006);

    results.push({
      taskName: "Investigation (TokenBucket)",
      category: "investigation",
      success,
      termination: agentResult.termination,
      iterations: agentResult.iterations,
      toolCallsCount: agentResult.toolCallsExecuted.length,
      latenciesMs: latencies,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      elapsedMs: elapsed,
      tokensEstimated: { prompt: estPromptTokens, completion: estCompletionTokens, total: estPromptTokens + estCompletionTokens },
      costEstimateUsd: cost,
      evidence: agentResult.toolCallsExecuted.map((t) => `${t.name}(${JSON.stringify(t.args)})`),
    });

    console.log(`  Error detail: ${agentResult.error}`);
    console.log(`Result: ${success ? "SUCCESS" : "INCOMPLETE"} (${agentResult.termination}) in ${elapsed}ms`);
  } finally {
    fix1.cleanUp();
  }

  // Task 2: Retrieval Recovery
  if (totalRequestsAcrossRun < MAX_TOTAL_REQUESTS) {
    console.log("\n--------------------------------------------------------------------------------");
    console.log("▶ Task 2/3: Autonomous Retrieval Recovery (Session claims validator discovery)");
    console.log("--------------------------------------------------------------------------------");
    const fix2 = createRetrievalRecoveryFixture();
    try {
      const tools = createInvestigationTools(fix2.fixtureDir);
      const goal = "Find the active session token validation function. Do not rely on deprecated modules. Report the required token prefix.";
      const grounded = assembleGroundedContext({ workspace: fix2.fixtureDir, goal });

      const start = Date.now();
      const latencies: number[] = [];
      const remainingLimit = Math.min(MAX_REQUESTS_PER_TASK, MAX_TOTAL_REQUESTS - totalRequestsAcrossRun);

      const agentResult = await runToolAgent(goal, tools, {}, {
        groundedContext: grounded,
        maxIterations: remainingLimit,
        onToolExecution: (rec) => {
          latencies.push(rec.durationMs);
          console.log(`  [Tool] ${rec.name} -> ${rec.durationMs}ms`);
        },
      });
      const elapsed = Date.now() - start;
      totalRequestsAcrossRun += agentResult.iterations;

      const success = agentResult.termination === "completed" && agentResult.text.includes("v2_");
      const p50 = calculatePercentile(latencies, 50);
      const p95 = calculatePercentile(latencies, 95);
      const promptChars = agentResult.promptChars || 2000;
      const completionChars = agentResult.text.length;
      const estPromptTokens = Math.round(promptChars / 4);
      const estCompletionTokens = Math.round(completionChars / 4);
      const cost = (estPromptTokens * 0.00000015) + (estCompletionTokens * 0.0000006);

      results.push({
        taskName: "Retrieval Recovery (Active Session Validator)",
        category: "retrieval_recovery",
        success,
        termination: agentResult.termination,
        iterations: agentResult.iterations,
        toolCallsCount: agentResult.toolCallsExecuted.length,
        latenciesMs: latencies,
        p50LatencyMs: p50,
        p95LatencyMs: p95,
        elapsedMs: elapsed,
        tokensEstimated: { prompt: estPromptTokens, completion: estCompletionTokens, total: estPromptTokens + estCompletionTokens },
        costEstimateUsd: cost,
        evidence: agentResult.toolCallsExecuted.map((t) => `${t.name}(${JSON.stringify(t.args)})`),
      });

      console.log(`  Error detail: ${agentResult.error}`);
    console.log(`Result: ${success ? "SUCCESS" : "INCOMPLETE"} (${agentResult.termination}) in ${elapsed}ms`);
    } finally {
      fix2.cleanUp();
    }
  }

  // Task 3: Bug-Fix Proposal
  if (totalRequestsAcrossRun < MAX_TOTAL_REQUESTS) {
    console.log("\n--------------------------------------------------------------------------------");
    console.log("▶ Task 3/3: Bug-Fix Proposal & Human Approval Enforcement (Array median comparator)");
    console.log("--------------------------------------------------------------------------------");
    const fix3 = createBugFixFixture();
    try {
      const invTools = createInvestigationTools(fix3.fixtureDir);

      let proposedPatch: string | null = null;
      let approvalGranted = false;

      const proposeMutationTool: StructuredTool = createAegisTool(
        async (args: { filePath: string; suggestedFix: string }) => {
          proposedPatch = args.suggestedFix;
          console.log(`\n[Agent Proposed Fix for ${args.filePath}]:\n${args.suggestedFix}`);
          approvalGranted = await requestHumanApproval(`Apply fix to ${args.filePath}`);
          if (!approvalGranted) {
            return JSON.stringify({ status: "REJECTED_OR_PAUSED", message: "Human user did not approve filesystem mutation." });
          }
          return JSON.stringify({ status: "APPROVED", message: "Human user approved fix." });
        },
        {
          name: "propose_code_fix",
          description: "Propose a code fix for human review and approval. NEVER mutates disk without approval.",
          schema: z.object({
            filePath: z.string().describe("Path to the file needing fix"),
            suggestedFix: z.string().describe("The suggested replacement code or diff"),
          }),
        }
      );

      const allTools = [...invTools, proposeMutationTool];
      const goal = "Inspect src/math/statistics.ts, diagnose the sorting bug in computeMedian, and propose a code fix.";
      const grounded = assembleGroundedContext({ workspace: fix3.fixtureDir, goal });

      const start = Date.now();
      const latencies: number[] = [];
      const remainingLimit = Math.min(MAX_REQUESTS_PER_TASK, MAX_TOTAL_REQUESTS - totalRequestsAcrossRun);

      const agentResult = await runToolAgent(goal, allTools, {}, {
        groundedContext: grounded,
        maxIterations: remainingLimit,
        onToolExecution: (rec) => {
          latencies.push(rec.durationMs);
          console.log(`  [Tool] ${rec.name} -> ${rec.durationMs}ms`);
        },
      });
      const elapsed = Date.now() - start;
      totalRequestsAcrossRun += agentResult.iterations;

      const success = (agentResult.termination === "completed" || agentResult.toolCallsExecuted.some(t => t.name === "propose_code_fix")) &&
        (agentResult.text.includes("sort") || proposedPatch !== null);

      const p50 = calculatePercentile(latencies, 50);
      const p95 = calculatePercentile(latencies, 95);
      const promptChars = agentResult.promptChars || 2000;
      const completionChars = agentResult.text.length;
      const estPromptTokens = Math.round(promptChars / 4);
      const estCompletionTokens = Math.round(completionChars / 4);
      const cost = (estPromptTokens * 0.00000015) + (estCompletionTokens * 0.0000006);

      results.push({
        taskName: "Bug-Fix Proposal (Numeric Median Sort)",
        category: "bug_fix_proposal",
        success,
        termination: agentResult.termination,
        iterations: agentResult.iterations,
        toolCallsCount: agentResult.toolCallsExecuted.length,
        latenciesMs: latencies,
        p50LatencyMs: p50,
        p95LatencyMs: p95,
        elapsedMs: elapsed,
        tokensEstimated: { prompt: estPromptTokens, completion: estCompletionTokens, total: estPromptTokens + estCompletionTokens },
        costEstimateUsd: cost,
        evidence: agentResult.toolCallsExecuted.map((t) => `${t.name}(${JSON.stringify(t.args)})`),
        humanApprovalGranted: approvalGranted,
      });

      console.log(`  Error detail: ${agentResult.error}`);
    console.log(`Result: ${success ? "SUCCESS" : "INCOMPLETE"} (${agentResult.termination}) in ${elapsed}ms`);
    } finally {
      fix3.cleanUp();
    }
  }

  // Final Summary
  console.log("\n================================================================================");
  console.log("  AEGIS P01 — REAL-MODEL ACCEPTANCE REPORT SUMMARY");
  console.log("================================================================================");
  let totalCost = 0;
  let totalTokens = 0;
  let totalToolCalls = 0;

  for (const r of results) {
    totalCost += r.costEstimateUsd;
    totalTokens += r.tokensEstimated.total;
    totalToolCalls += r.toolCallsCount;
    console.log(`\nTask: ${r.taskName}`);
    console.log(`  - Category        : ${r.category}`);
    console.log(`  - Status          : ${r.success ? "✅ PASSED" : "❌ FAILED"} (Termination: ${r.termination})`);
    console.log(`  - Iterations      : ${r.iterations}`);
    console.log(`  - Tool Calls      : ${r.toolCallsCount}`);
    console.log(`  - Latency (p50)   : ${r.p50LatencyMs}ms`);
    console.log(`  - Latency (p95)   : ${r.p95LatencyMs}ms`);
    console.log(`  - Elapsed Time    : ${r.elapsedMs}ms`);
    console.log(`  - Tokens Est.     : ${r.tokensEstimated.total}`);
    console.log(`  - Cost Est.       : $${r.costEstimateUsd.toFixed(6)} USD`);
    if (r.category === "bug_fix_proposal") {
      console.log(`  - Human Approval  : ${r.humanApprovalGranted ? "GRANTED" : "NOT GRANTED / HELD SAFE"}`);
    }
  }

  console.log("\n── Overall Acceptance Totals ──");
  console.log(`Tasks Completed     : ${results.length}/${MAX_TASKS}`);
  console.log(`Tasks Passing       : ${results.filter((r) => r.success).length}/${results.length}`);
  console.log(`Total Model Requests: ${totalRequestsAcrossRun}/${MAX_TOTAL_REQUESTS}`);
  console.log(`Total Tool Calls    : ${totalToolCalls}`);
  console.log(`Total Est. Tokens   : ${totalTokens}`);
  console.log(`Total Est. Cost     : $${totalCost.toFixed(6)} USD`);
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("Live evaluation execution error:", err);
  process.exit(1);
});
