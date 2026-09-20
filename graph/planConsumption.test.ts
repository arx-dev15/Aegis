/**
 * graph/planConsumption.test.ts
 *
 * R02 — Plan Artifact Consumption Finalization Tests
 *
 * Verifies:
 *   TEST 1 — PLANNER STRUCTURED FIELDS: title, dependencies, verification preserved in state.plan
 *   TEST 2 — RESEARCHER RECEIVES ROLE PLAN: Researcher generation receives investigation-oriented plan context
 *   TEST 3 — ARCHITECT RECEIVES ROLE PLAN: Architect generation receives design-oriented plan context alongside research
 *   TEST 4 — DEVELOPER RECEIVES ROLE PLAN: Developer generation receives implementation plan context, architecture, AND R01 existing source
 *   TEST 5 — EMPTY PLAN COMPATIBILITY: Empty state.plan ([]) retains backwards compatibility without throwing
 *   TEST 6 — RECOVERY PRESERVES PLAN: Recovery retries receive original plan context AND recovery context
 *   TEST 7 — FORMATTING DOES NOT MUTATE STATE: formatPlanContext is purely read-only
 *   TEST 8 — R01 GROUNDING INTACT: Real filesystem source inspection preserved alongside plan context
 *
 * Run with:
 *   npx tsx graph/planConsumption.test.ts
 */

import os from "os";
import path from "path";
import { promises as fs } from "fs";

import { createPlannerNode } from "./nodes/plannerNode.js";
import { createResearcherNode } from "./nodes/researcherNode.js";
import { createArchitectNode } from "./nodes/architectNode.js";
import { createDeveloperNode } from "./nodes/developerNode.js";
import { formatPlanContext } from "./planContext.js";

import { PlannerAgent } from "../agents/planner/planner.js";
import { ResearcherAgent } from "../agents/researcher/researcher.js";
import { ArchitectAgent } from "../agents/architect/architect.js";
import { DeveloperAgent } from "../agents/developer/developer.js";

import type { PlannerModel } from "../agents/planner/planner.js";
import type { ResearcherModel } from "../agents/researcher/researcher.js";
import type { ArchitectModel } from "../agents/architect/architect.js";
import type { DeveloperModel } from "../agents/developer/developer.js";
import type { AegisState, PlanStep } from "./state.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

let lastCapturedResearcherPrompt = "";
let lastCapturedArchitectPrompt = "";
let lastCapturedDeveloperPrompt = "";

const mockPlannerModel: PlannerModel = {
  async generateStructured<T>(): Promise<T> {
    return {
      goal: "Test Goal",
      summary: "Test Summary",
      steps: [
        { id: "step-1", title: "Investigate API", description: "Check routes", dependencies: ["step-0"], verification: "AST Check" },
        { id: "step-2", title: "Add Guards", description: "Check types", dependencies: ["step-1"], verification: "Unit Test" },
      ],
      risks: [],
      verificationStrategy: [],
    } as unknown as T;
  },
};

const trackingResearcherModel: ResearcherModel = {
  async generateStructured<T>(_sys: string, userPrompt: string): Promise<T> {
    lastCapturedResearcherPrompt = userPrompt;
    return {
      objective: "Research objective",
      summary: "Research summary",
      findings: [{ topic: "Auth", finding: "No auth found", evidence: "AST search" }],
      constraints: ["Preserve API"],
      unknowns: [],
      risks: [],
    } as unknown as T;
  },
};

const trackingArchitectModel: ArchitectModel = {
  async generateStructured<T>(_sys: string, userPrompt: string): Promise<T> {
    lastCapturedArchitectPrompt = userPrompt;
    return {
      title: "Design Title",
      summary: "Architectural summary",
      components: [{ name: "Calculator", description: "Math module", type: "module", responsibilities: ["add", "multiply"] }],
      dataFlow: ["Input -> Validate -> Compute"],
      dependencies: [],
      risks: [],
      verificationPlan: ["Unit tests"],
    } as unknown as T;
  },
};

const trackingDeveloperModel: DeveloperModel = {
  async generateStructured<T>(_sys: string, userPrompt: string): Promise<T> {
    lastCapturedDeveloperPrompt = userPrompt;
    return {
      task: "Dev Task",
      summary: "Dev summary",
      fileChanges: [
        {
          path: "src/math.ts",
          action: "modify",
          summary: "Added validation",
          content: "export function multiply(a: number, b: number) { return a * b; }",
        },
      ],
      commandsExecuted: [],
      status: "completed",
    } as unknown as T;
  },
};

const samplePlan: PlanStep[] = [
  { id: "step-1", title: "Investigate math exports", description: "Investigate math exports: Inspect existing math export", status: "pending", dependencies: ["step-0"], verification: "AST check" },
  { id: "step-2", title: "Add type validation", description: "Add type validation: Throw TypeError on non-number parameters", status: "pending", dependencies: ["step-1"], verification: "Unit test" },
];

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== R02 — Plan Artifact Consumption Finalization Tests ===\n");

  const researcherAgent = new ResearcherAgent(trackingResearcherModel);
  const researcherNode = createResearcherNode(researcherAgent);

  const architectAgent = new ArchitectAgent(trackingArchitectModel);
  const architectNode = createArchitectNode(architectAgent);

  const developerAgent = new DeveloperAgent(trackingDeveloperModel);
  const developerNode = createDeveloperNode(developerAgent);

  // ── TEST 1: Planner Structured Fields Mapped ─────────────────────────────────
  try {
    console.log("Test 1: Planner Structured Fields — title, dependencies, verification preserved...");
    const plannerNode = createPlannerNode(new PlannerAgent(mockPlannerModel));
    const pUpdate = await plannerNode({ task: "Goal" } as AegisState);

    const steps = (pUpdate.plan as PlanStep[]) ?? [];
    if (steps.length !== 2) throw new Error("Expected 2 plan steps from plannerNode");
    if (steps[0].title !== "Investigate API") throw new Error(`Expected title 'Investigate API', got '${steps[0].title}'`);
    if (!steps[0].dependencies || steps[0].dependencies[0] !== "step-0") throw new Error("Expected dependencies preserved");
    if (steps[0].verification !== "AST Check") throw new Error("Expected verification preserved");

    console.log(`${PASS} Test 1: Planner structured fields (title, dependencies, verification) preserved in state.plan.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 2: Researcher Receives Role Plan ──────────────────────────────────────
  try {
    console.log("\nTest 2: Researcher Receives Role Plan — Prompt contains PLAN CONTEXT FOR INVESTIGATION...");
    lastCapturedResearcherPrompt = "";

    const state: Partial<AegisState> = {
      task: "Add input validation to multiply API",
      plan: samplePlan,
    };

    await researcherNode(state as AegisState);

    if (!lastCapturedResearcherPrompt.includes("PLAN CONTEXT FOR INVESTIGATION")) {
      throw new Error("Researcher prompt did not contain 'PLAN CONTEXT FOR INVESTIGATION' block");
    }

    if (!lastCapturedResearcherPrompt.includes("Verify repository-specific assumptions")) {
      throw new Error("Researcher prompt did not contain evidence verification guidance note");
    }

    console.log(`       Captured Prompt Snippet: "${lastCapturedResearcherPrompt.slice(0, 160).replace(/\n/g, " ")}..."`);
    console.log(`${PASS} Test 2: Researcher receives investigation-oriented plan context.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 3: Architect Receives Role Plan ───────────────────────────────────────
  try {
    console.log("\nTest 3: Architect Receives Role Plan — Prompt contains PLAN CONTEXT FOR DESIGN & Research...");
    lastCapturedArchitectPrompt = "";

    const state: Partial<AegisState> = {
      task: "Add input validation to multiply API",
      plan: samplePlan,
      research: "Research summary: No auth found",
    };

    await architectNode(state as AegisState);

    if (!lastCapturedArchitectPrompt.includes("PLAN CONTEXT FOR DESIGN")) {
      throw new Error("Architect prompt did not contain 'PLAN CONTEXT FOR DESIGN' block");
    }

    if (!lastCapturedArchitectPrompt.includes("Research Input:")) {
      throw new Error("Architect prompt did not contain 'Research Input:' block");
    }

    console.log(`       Captured Prompt Snippet: "${lastCapturedArchitectPrompt.slice(0, 160).replace(/\n/g, " ")}..."`);
    console.log(`${PASS} Test 3: Architect receives design-oriented plan context alongside research.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 3: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 4: Developer Receives Role Plan & R01 Grounding ───────────────────────
  const testWs = path.join(os.tmpdir(), `aegis-r02-test-${Date.now()}`);
  await fs.mkdir(path.join(testWs, "src"), { recursive: true });
  const testFile = path.join("src", "math.ts");
  await fs.writeFile(path.join(testWs, testFile), "export function multiply(a: number, b: number) { return a * b; }", "utf-8");

  try {
    console.log("\nTest 4: Developer Receives Role Plan & R01 Grounding Preserved...");
    lastCapturedDeveloperPrompt = "";

    const state: Partial<AegisState> = {
      task: "Add input validation to src/math.ts",
      plan: samplePlan,
      architecture: "Update src/math.ts with argument guards",
      workspace: testWs,
      approvalDecision: { approvalId: "app-r02", action: "approve", decidedAt: Date.now() },
    };

    const res = await developerNode(state as AegisState);

    if (!lastCapturedDeveloperPrompt.includes("PLAN CONTEXT FOR IMPLEMENTATION")) {
      throw new Error("Developer prompt did not contain 'PLAN CONTEXT FOR IMPLEMENTATION' block");
    }

    if (!lastCapturedDeveloperPrompt.includes("EXISTING REPOSITORY SOURCE CODE:")) {
      throw new Error("Developer prompt did not contain R01 'EXISTING REPOSITORY SOURCE CODE:' block");
    }

    const logs = (res.executionLog as string[]) ?? [];
    if (!logs.some((l: string) => l.includes("[DEV-PLAN] Developer received 2 plan step(s)"))) {
      throw new Error("Developer executionLog did not record receiving plan steps");
    }

    console.log(`       Captured Prompt Plan Snippet: "${lastCapturedDeveloperPrompt.slice(lastCapturedDeveloperPrompt.indexOf("PLAN CONTEXT FOR IMPLEMENTATION"), 150).replace(/\n/g, " ")}..."`);
    console.log(`${PASS} Test 4: Developer receives implementation plan context while preserving R01 workspace grounding.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 4: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 5: Empty Plan Compatibility ──────────────────────────────────────────
  try {
    console.log("\nTest 5: Empty Plan Compatibility — state.plan = []...");
    lastCapturedResearcherPrompt = "";
    lastCapturedArchitectPrompt = "";
    lastCapturedDeveloperPrompt = "";

    const emptyState: Partial<AegisState> = {
      task: "Task without plan",
      plan: [],
      architecture: "Arch without plan",
      workspace: testWs,
      approvalDecision: { approvalId: "app-r02-empty", action: "approve", decidedAt: Date.now() },
    };

    await researcherNode(emptyState as AegisState);
    await architectNode(emptyState as AegisState);
    await developerNode(emptyState as AegisState);

    if (lastCapturedResearcherPrompt.includes("PLAN CONTEXT FOR INVESTIGATION")) throw new Error("Researcher should not contain plan block when plan is empty");
    if (lastCapturedArchitectPrompt.includes("PLAN CONTEXT FOR DESIGN")) throw new Error("Architect should not contain plan block when plan is empty");
    if (lastCapturedDeveloperPrompt.includes("PLAN CONTEXT FOR IMPLEMENTATION")) throw new Error("Developer should not contain plan block when plan is empty");

    console.log(`${PASS} Test 5: Empty plan state ([]) operates cleanly without errors or unwanted prompt blocks.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 5: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 6: Recovery Preserves Plan ───────────────────────────────────────────
  try {
    console.log("\nTest 6: Recovery Preserves Plan — Developer retry receives original plan & repair context...");
    lastCapturedDeveloperPrompt = "";

    const recoveryState: Partial<AegisState> = {
      task: "Fix type error in src/math.ts",
      plan: samplePlan,
      architecture: "Update src/math.ts with argument guards",
      workspace: testWs,
      approvalDecision: { approvalId: "app-r02-rec", action: "approve", decidedAt: Date.now() },
      recoveryContext: [
        {
          failingAgent: "tester",
          reason: "Type mismatch",
          details: ["multiply('1', '2') failed"],
          attemptNumber: 1,
        },
      ],
    };

    await developerNode(recoveryState as AegisState);

    if (!lastCapturedDeveloperPrompt.includes("PLAN CONTEXT FOR IMPLEMENTATION")) {
      throw new Error("Developer retry prompt did not contain 'PLAN CONTEXT FOR IMPLEMENTATION' block");
    }

    if (!lastCapturedDeveloperPrompt.includes("REPAIR CONTEXT")) {
      throw new Error("Developer retry prompt did not contain 'REPAIR CONTEXT' block");
    }

    console.log(`${PASS} Test 6: Developer recovery retry receives both original plan and failure repair context.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 6: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 7: Formatting Does Not Mutate State ─────────────────────────────────
  try {
    console.log("\nTest 7: Formatting Does Not Mutate State...");
    const originalJson = JSON.stringify(samplePlan);
    formatPlanContext(samplePlan, "researcher");
    formatPlanContext(samplePlan, "architect");
    formatPlanContext(samplePlan, "developer");
    if (JSON.stringify(samplePlan) !== originalJson) {
      throw new Error("formatPlanContext mutated input samplePlan object");
    }
    console.log(`${PASS} Test 7: formatPlanContext is purely read-only and does not mutate input plan array.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 7: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 8: R01 Grounding Intact ─────────────────────────────────────────────
  try {
    console.log("\nTest 8: R01 Grounding Intact — File read and content passed to developer prompt...");
    if (!lastCapturedDeveloperPrompt.includes("export function multiply(a: number, b: number)")) {
      throw new Error("Developer prompt did not contain source content from disk file");
    }
    console.log(`${PASS} Test 8: Real filesystem source inspection preserved alongside plan context.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 8: ${(err as Error).message}`);
    failed++;
  }

  // Cleanup temp directory
  try { await fs.rm(testWs, { recursive: true, force: true }); } catch {}

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
