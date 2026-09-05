# Aegis Technical Implementation Strategy Plan

This document details the practical implementation strategies for key Aegis subsystems, serving as a technical guide for AI coding agents and human engineers.

---

## 1. Implementation Principles

1. **Non-Destructive Additive Development**: Every new capability must integrate cleanly without deleting working backend, frontend, or agent code.
2. **Explicit Data Flow over Over-Abstraction**: Prefer explicit function calls, typed interfaces, and clean State Annotations over deep class inheritance or magic dependency injection.
3. **Production Realism**: Production code uses real external data (e.g. live `api.github.com` REST APIs, real filesystem operations). Mocks are strictly isolated to automated unit test files.
4. **Safety by Default**: Destructive or sensitive actions pass through explicit policy guardrails (`tools/guardrails/`) and Human-in-the-Loop approval gates (`graph/approvalWorkflow.ts`).

---

## 2. Component Implementation Strategies

### 2.1 Agent Implementation Strategy (`agents/`) `[IMPLEMENTED]`
- **Base Agent (`agents/agent.ts`)**: Implements `callStructured<T>()` using `@google/genai` to bind Zod schemas directly to Gemini model responses.
- **Model Isolation**: Agents invoke `callStructured` through typed model wrappers (`GeminiPlannerModel`, `GeminiArchitectModel`, etc.), allowing test code to inject mock models seamlessly while production code targets `gemini-2.5-flash`.
- **Specialization**: Each of the 7 agents defines a single responsibility with a strict Zod output schema (`agents/<agent>/types.ts`).

### 2.2 Orchestration Strategy (`graph/`) `[IMPLEMENTED]`
- **LangGraph State (`graph/state.ts`)**: `AegisStateAnnotation` acts as the single source of truth across all graph nodes.
- **Dynamic Handoff (`graph/edges/agentRouter.ts`)**: `determineNextAgent(state)` inspects task status and artifact existence to route dynamically. If plan and architecture are pre-populated, execution skips prior nodes and proceeds straight to `developer`.
- **Failure Recovery (`graph/nodes/recoveryNode.ts`)**: When tests fail (`testResults.passed === false`) or code review rejects a diff, `recoveryNode` constructs a `RecoveryContext` (failing agent, reason, attempt number) and routes back to Developer or Architect without re-running the entire workflow.

### 2.3 Repository Intelligence Strategy (`repo-intelligence/`) `[IMPLEMENTED]`
- **AST Parsing (`repo-intelligence/parsers/tsParser.ts`)**: Uses `ts-morph` to traverse TypeScript/JavaScript ASTs, extracting symbols (classes, functions, methods, interfaces, types), line ranges, and export flags.
- **Domain Extractors (`repo-intelligence/extractors/`)**: Extracts Express/Next.js routes (`apiExtractor`), SQL/Prisma schemas (`databaseExtractor`), dependencies (`dependencyExtractor`), and test targets (`testExtractor`).
- **Graph Synthesis (`repo-intelligence/relationships/graphEngine.ts`)**: Creates provenanced edges (`CALLS`, `IMPORTS`, `HANDLES`, `QUERIES`, `TESTED_BY`, `USES`) with line-level evidence and confidence ratings (`exact`, `inferred`).
- **Impact Analysis (`repo-intelligence/retrieval/hybridRetriever.ts`)**: Implements a 5-stage target resolution pipeline (`exact` -> `case` -> `partial` -> `candidate` -> `unresolved`) and dynamic multi-hop BFS traversal (`computeDynamicImpactReport`).

### 2.4 Real GitHub Strategy (`tools/github/`) `[IMPLEMENTED]`
- **Live API Integration**: `GitHubClient` (`tools/github/client.ts`) uses Node native `fetch` against `api.github.com` with `GITHUB_TOKEN` from `.env`.
- **Guardrail Integration**: Tool calls pass through `enforceToolGuardrail()`. Read operations execute immediately; branch/commit/PR creations require human approval.
- **Credential Protection**: Tokens are masked from error messages, tool outputs, and WebSocket payloads.

### 2.5 Safety & Approval Strategy (`tools/guardrails/` & `graph/approvalWorkflow.ts`) `[IMPLEMENTED]`
- **Policy Engine**: `evaluatePermission(input)` evaluates tool actions into `ALLOW`, `REQUIRE_APPROVAL`, or `BLOCK`.
- **Graph Interruption**: `approvalCheckGateNode` checks policy decisions. If `REQUIRE_APPROVAL`, state transitions to `status: "paused"` and graph interrupts via `MemorySaver` checkpointer.
- **Resume Handling**: Human decisions (`APPROVE` / `REJECT`) are passed via `resolveApprovalAndResume()`. If `APPROVE`, execution continues; if `REJECT`, sensitive actions are prevented and execution logs refusal context.

### 2.6 Dual Memory Strategy (`memory/`) `[IMPLEMENTED]`
- **Short-Term Memory**: Execution-scoped scratchpad (`memory/short-term/shortTermMemory.ts`) tied to `runId`.
- **Long-Term Memory**: Persistent store (`memory/long-term/longTermMemory.ts`) rehydrating from `memory/long-term/storage.json` across process restarts.
- **Separation from RAG**: Memory stores architectural facts and project rules; RAG embeds raw codebase document chunks.

### 2.7 Interactive CLI Strategy (`cli.ts`) `[IMPLEMENTED]`
- **First-Class Entrypoint**: `cli.ts` imports Aegis core services directly.
- **Automatic Token Resolution**: Reads `GITHUB_TOKEN` from `.env` automatically if not explicitly supplied as an argument.
- **Commands**: Supports `connect <url>`, `status <repoId>`, `search <repoId> "<query>"`, and `impact <repoId> <targetEntity>`.

---

## 3. Strategy for Future Architecture Simplification `[PLANNED]`

Once all core features are stable, an architectural consolidation will be executed under these strict rules:
1. **Zero Behavioral Changes**: All existing agent capabilities, API endpoints, WebSocket handlers, and tests must remain 100% functional.
2. **Consolidate Fragmented Files**: Merge single-function helper files into domain-cohesive modules.
3. **Simplify Import Graphs**: Eliminate unnecessary barrel file nesting.
4. **Preserve Public Contracts**: Keep public exported function signatures intact so external callers (CLI, API controllers, tests) require zero refactoring.