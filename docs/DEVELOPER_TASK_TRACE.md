# AEGIS Developer Task Trace Guide

This document explains the canonical runtime path for a task in AEGIS P01: Native Agent Runtime, from CLI entry to final verified evidence.

---

## 1. Execution Architecture Overview

`
User CLI Command (cli.ts)
   │
   ▼
apps/cli/cliSession.ts (or src/runtime/runManager.ts)
   │
   ▼
src/context/groundedContext.ts (Workspace & Repo Intelligence)
   │
   ▼
src/agent/agent.ts (runToolAgent Native Iterative Loop)
   │  ├── src/agent/models/universalModel.ts (Provider Adapter: Gemini / OpenAI / Anthropic)
   │  └── src/tools/investigation/index.ts (Safe Read-Only Workspace Tools)
   │
   ▼
[Model Proposes Mutation: propose_file_change]
   │
   ▼
src/runtime/approvalWorkflow.ts (Approval Gate & Human-in-the-Loop)
   │  ├── Hash Baseline Snapshot (captureWorkspaceBaseline)
   │  └── Execution Paused -> Generates ApprovalRequest ID (appr_...)
   │
   ▼
Human Approval (CLI: npx tsx cli.ts approve <runId> <approvalId> approve)
   │
   ▼
src/runtime/approvalWorkflow.ts (applyProposalNode)
   │  ├── Pre-Apply Revalidation: checkApprovalBaselineConflicts
   │  │   └── If disk modified concurrently: FAIL-CLOSED (aborts with zero disk mutations)
   │  └── Safe Mutation Application (writes only authorized diffs)
   │
   ▼
src/verification/workspaceEvidence.ts & src/tools/terminal/sandbox.ts
   │  └── Authoritative Execution Verification (isolated container or fail-closed boundary)
   │
   ▼
Final Verification Evidence & Run State Persisted (.aegis/runs/<runId>.json)
`

---

## 2. Step-by-Step Path Breakdown

### Step 1: Entry & CLI Session
- **Entry File**: cli.ts -> pps/cli/cliSession.ts
- **CLI Commands**:
  - 
px tsx cli.ts  goal — Runs single task run.
  - 
px tsx cli.ts interactive — Launches multi-turn conversational session.
  - 
px tsx cli.ts approve <runId> <approvalId> <decision> — Submits human approval decision.

### Step 2: Context Grounding
- **File**: src/context/groundedContext.ts
- **Function**: ssembleGroundedContext({ workspace, goal })
- **Behavior**: Scans active workspace, extracts top symbols, active files, and skills into a bounded context object injected into the agent prompt.

### Step 3: Canonical Native Agent Loop
- **File**: src/agent/agent.ts
- **Function**: 
unToolAgent(goal, tools, state, options)
- **Loop Lifecycle**:
  1. Formats turn messages and grounded context.
  2. Invokes configured provider via universalModel.ts.
  3. Validates tool arguments against Zod schemas (handles stringified JSON gracefully).
  4. Executes permitted tools through centralized security policies (src/security/guardrails.ts).
  5. Attaches tool observations with strictly synchronized call.id.
  6. Continues until model outputs final answer or proposes file mutation.

### Step 4: Provider Adapter Layer
- **File**: src/agent/models/universalModel.ts & src/agent/models/providerConfig.ts
- **Responsibility**: Translates provider-neutral messages into vendor schemas (Google Gemini SDK, OpenAI-compatible APIs, Anthropic). Enforces token limits, abort signals, and handles 429 quota exhaustion vs 503 transient overload.

### Step 5: Guarded Modification & Baseline Conflict Detection
- **Files**: src/verification/changeEvidence.ts, src/runtime/approvalWorkflow.ts
- **Mechanism**:
  - captureWorkspaceBaseline: Computes SHA-256 hashes of all target files before approval.
  - checkApprovalBaselineConflicts: At apply time, re-computes hashes on disk. If external modifications occurred while approval was pending, application is aborted immediately with BASELINE CONFLICT DETECTED.

### Step 6: Isolated Verification & Final Evidence
- **Files**: src/tools/terminal/sandbox.ts, src/verification/workspaceEvidence.ts
- **Mechanism**: Runs verification test command. Untrusted commands execute strictly inside sandbox boundaries; if Docker is unavailable in untrusted mode, execution fails closed without host fallback.
