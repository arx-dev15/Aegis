# AEGIS V0 — Implementation Readiness and Code Reuse Assessment

**Assessment date:** 2026-10-12  
**Target:** A genuinely functional CLI-first TypeScript coding harness with `INVESTIGATE` and `FIX` workflows.

This document is based on the current source tree, executable tests, build commands, existing architecture documentation, and `AEGIS_REPOSITORY_AUDIT.md`. It distinguishes intended architecture from verified runtime behavior. The current repository contains pre-existing and Phase 1 worktree changes; this assessment does not treat dirty files or generated snapshots as proof of a clean release state.

## 1. Current Technical Baseline

### 1.1 Verified baseline

| Area | Evidence | Current conclusion |
|---|---|---|
| Root TypeScript build | `npm run build` passed during Phase 1 validation | Root source compiles |
| Frontend build | `cd apps/web && npm run build` passed | Web bundle compiles, but this does not prove a connected product flow |
| Agent and graph tests | Root suite progressed through planner, researcher, architect, developer, tester, reviewer, security, graph, RAG, memory, approval, GitHub, repository-intelligence, and terminal suites | Many components are executable in isolation |
| Approval guardrails | `npx tsx tools/guardrails/guardrails.test.ts` passed 8/8 after Phase 1 changes | Approval policy and graph approval behavior have targeted evidence |
| Controlled terminal workflow | `npx tsx graph/terminalWorkflow.test.ts` passed 5/5 after Phase 1 changes | Allow/block/approve/reject/failure propagation has targeted evidence |
| API typecheck/build | `cd apps/api && npm run typecheck` and `npm run build` remained failing | API package is not a V0 dependency and is not a passing baseline |
| Full master test completion | The Phase 1 run stalled during the GitHub/terminal portion and was stopped | Full-suite completion is unverified |
| Live Gemini task | `runDemo.ts` and model code provide a live path, but no paid/live task was invoked during validation | Live end-to-end coding success is unverified |

### 1.2 Important repository facts

- The root package is CommonJS-oriented while much of the source uses `.js` import suffixes and the root build uses a separate `tsconfig.json`.
- `cli.ts` is named and documented as interactive, but it is a command dispatcher, not a readline session. It supports `connect`, `status`, `search`, `impact`, `run`, and `approve`.
- The strongest existing engineering path is:

  `cli.ts run` → `executeApprovalWorkflow` → approval-aware LangGraph → specialized nodes → guarded filesystem/terminal tools → `.aegis/runs` state.

- `cli.ts connect` indexes a repository into JSON snapshots, and `developerNode.ts` can locate a matching snapshot and retrieve bounded source context before model-generated changes.
- The multi-agent graph and approval graph are separate workflow builders with overlapping agents and state transitions.
- `apps/api` and `apps/web` are a separate product surface. The audit found that API state, graph state, approvals, files, and events are not one synchronized lifecycle.
- There is no source-level skills directory or skills registry in the repository. The word “skills” appears in product direction/documentation, not as a verified runtime capability.

## 2. Existing Module Reuse Matrix

### 2.1 User entry points and orchestration

| Subsystem | Real source files / entry points | Actual functionality | Integration status and evidence | Missing behavior | Recommendation |
|---|---|---|---|---|---|
| CLI repository intelligence | [`cli.ts`](./cli.ts) | Connects local/GitHub repositories, scans files, extracts symbols/imports/APIs/databases/tests/dependencies, analyzes Git history, builds relationships, saves JSON snapshot, supports search/status/impact | Directly executable by `npx tsx cli.ts`; documented usage; strongest existing CLI surface | `connect` and `run` are separate commands; indexed repository context is not made a first-class run object | **REUSE**, then **ADAPT** |
| CLI engineering run | [`cli.ts`](./cli.ts), [`graph/approvalWorkflow.ts`](./graph/approvalWorkflow.ts) | Starts an approval-aware run, prints pause details, resumes with `approve` command | Targeted approval tests pass; runtime state persisted to `.aegis/runs` | No structured CLI result format, no investigation-only route, limited run inspection, no explicit cancel/retry command | **ADAPT** |
| Demo runner | [`runDemo.ts`](./runDemo.ts), [`graph/multiAgentWorkflow.ts`](./graph/multiAgentWorkflow.ts) | Runs the seven-agent graph in simulation or a temporary real workspace and prints output | Component/runtime demonstration code exists | It is a demonstration path, not the canonical CLI lifecycle; does not implement human approval as the main flow | **REUSE selectively**, **RETIRE LATER** as a product entry point |
| Legacy simple graph | [`graph/workflow.ts`](./graph/workflow.ts), `graph/nodes/sampleNodes.ts` | Minimal input/task/error graph | Unit-level historical implementation | Not connected to the V0 product path and duplicates newer orchestration | **RETIRE LATER** |

### 2.2 Gemini and agent execution

| Subsystem | Real source files / entry points | Actual functionality | Integration status and evidence | Missing behavior | Recommendation |
|---|---|---|---|---|---|
| Gemini text model | [`models/gemini/model.ts`](./models/gemini/model.ts) | Shared `GoogleGenAI` client, configurable model/temperature, fallback model attempts, explicit rate-limit errors | Used by specialized agent adapters and tested through model/agent tests; live API path not exercised in this assessment | Fallback policy is embedded in the model layer; no run-level model usage/evidence record | **REUSE**, **ADAPT** |
| Gemini structured output | [`models/gemini/structured.ts`](./models/gemini/structured.ts), `models/gemini/structured.test.ts` | Converts supported Zod schemas to Google schemas, requests JSON, strips nulls, validates with Zod, retries transient errors | Dedicated structured-output tests exist | Converter supports a limited schema subset and uses internal `any`; no schema/version metadata in run evidence | **REUSE** |
| Native tool loop | [`agents/agent.ts`](./agents/agent.ts), [`tools/types.ts`](./tools/types.ts) | Converts `StructuredTool` schemas to Gemini function declarations, executes requested tools, sends results back for one final response, records tool calls | Source and agent tests establish the loop shape | Only one tool round is implemented; no loop limit beyond the single response cycle, no shared policy-aware tool registry, no durable trace persistence | **ADAPT** |
| Specialized agents | `agents/planner`, `researcher`, `architect`, `developer`, `tester`, `reviewer`, `security` | Role-specific prompts/types/models; developer and tester have real I/O bridges | Agent tests and multi-agent tests pass; default live model execution is unverified | Agent outputs are graph-specific and not normalized into one V0 task contract | **REUSE**, then **CONSOLIDATE** |

### 2.3 LangGraph workflows and state

| Subsystem | Real source files / entry points | Actual functionality | Integration status and evidence | Missing behavior | Recommendation |
|---|---|---|---|---|---|
| Shared state | [`graph/state.ts`](./graph/state.ts) | LangGraph annotation state for task, plan, context, changes, tests, review, errors, retries, workspace, logs, approvals, execution mode, evidence | Used across the graph tests and approval/terminal tests | State mixes working context, lifecycle, approval, and evidence; no stable serialized V0 run schema/version | **ADAPT** |
| Full multi-agent graph | [`graph/multiAgentWorkflow.ts`](./graph/multiAgentWorkflow.ts) | Planner → researcher → architect → developer → tester → reviewer → security with retry routing | `runDemo.ts` and component tests exercise it; real end-to-end mission is not a release criterion yet | Separate from approval-aware graph; no canonical persistence/resume contract | **CONSOLIDATE** |
| Approval-aware graph | [`graph/approvalWorkflow.ts`](./graph/approvalWorkflow.ts) | Proposal generation, approval pause, approve/reject resume, safe apply, tester/reviewer routing, rejection termination, checkpointing | Targeted approval and terminal workflow tests pass after Phase 1 fixes | Current route still requires careful lifecycle integration; security node is not part of this graph’s final path | **REUSE as V0 base**, then **ADAPT** |
| Checkpoint/runtime registry | `approvalRuntime` in [`graph/approvalWorkflow.ts`](./graph/approvalWorkflow.ts) | In-memory active runs plus JSON snapshots under `.aegis/runs` | Approval tests create and reload persisted run snapshots | Broad catches suppress persistence errors; history is not exposed as a formal event stream; graph checkpoint and custom snapshot can diverge | **ADAPT** |

### 2.4 Repository intelligence and context engineering

| Subsystem | Real source files / entry points | Actual functionality | Integration status and evidence | Missing behavior | Recommendation |
|---|---|---|---|---|---|
| Repository ingestion | `repo-intelligence/connection`, `scanner`, `extractors`, `parsers`, `git` | Validates local/GitHub sources, optionally clones remote repositories, scans and extracts structured repository facts | `cli.ts connect` and repository-intelligence tests exercise the pipeline; snapshots exist in `.gemini/antigravity-ide/brain/repo_intelligence` | API compilation currently fails around this domain; ingestion is separate from run lifecycle | **REUSE**, **ADAPT** |
| Snapshot persistence | [`repo-intelligence/storage/jsonStore.ts`](./repo-intelligence/storage/jsonStore.ts) | Atomic JSON snapshot writes, index maintenance, repository listing and retrieval | CLI status/search and repository-intelligence tests use it | No revision freshness policy, lock/concurrency policy, or run-scoped snapshot reference contract | **REUSE** |
| Structural retrieval | [`repo-intelligence/retrieval/hybridRetriever.ts`](./repo-intelligence/retrieval/hybridRetriever.ts) | Symbol/API/database/test/relationship matching, impact reports, bounded formatted context | CLI search/impact and developer inspection call it | Heuristic matching is not a general semantic answer engine; evidence is returned but not uniformly persisted into runs | **REUSE**, **ADAPT** |
| RAG/project knowledge | [`rag/pipeline.ts`](./rag/pipeline.ts), [`rag/projectKnowledge.ts`](./rag/projectKnowledge.ts), vector store | Chunking, embeddings, retrieval, project knowledge context; in-memory vector store | RAG and project-knowledge tests pass | Not consistently wired into the canonical CLI run; semantic cache is process-local | **ADAPT selectively** |
| Working versus durable memory | [`memory/memoryManager.ts`](./memory/memoryManager.ts), short/long-term memory modules | Short-term run context and JSON-backed long-term records with formatted context | Memory tests pass; developer node reads memory context | Default long-term path is module-relative and memory is not clearly keyed to a canonical project/run lifecycle | **ADAPT**, keep separate from repository snapshots |

### 2.5 Tools, policy, approval, and evidence

| Subsystem | Real source files / entry points | Actual functionality | Integration status and evidence | Missing behavior | Recommendation |
|---|---|---|---|---|---|
| Filesystem | [`tools/filesystem/index.ts`](./tools/filesystem/index.ts) | Safe read/write/create/delete under a root, path escape checks, guardrail calls | Developer/workspace evidence and tests exercise it | `safePath` uses a read action for reads and path checks need one shared workspace contract | **REUSE**, **ADAPT** |
| Terminal | [`tools/terminal/index.ts`](./tools/terminal/index.ts), [`graph/nodes/testerNode.ts`](./graph/nodes/testerNode.ts) | Guarded shell execution, workspace containment, timeout/kill, output truncation, secret scrubbing, structured result | Terminal unit and 5-block workflow tests pass | Command result is interpreted by tester but not always represented as a durable evidence record | **REUSE** |
| Guardrails | [`tools/guardrails/policyEngine.ts`](./tools/guardrails/policyEngine.ts), [`tools/guardrails/enforcer.ts`](./tools/guardrails/enforcer.ts) | Explicit `ALLOW`, `REQUIRE_APPROVAL`, `BLOCK`; dangerous command/path checks; approved mutation bypass for non-dangerous actions | Guardrails 8/8 and terminal approval tests pass | Policy is called directly by tools and graph approval independently; no single tool-boundary context object | **CONSOLIDATE** |
| GitHub | [`tools/github/index.ts`](./tools/github/index.ts), `tools/github/client.ts` | Guarded read/write GitHub REST operations exposed as a structured tool | GitHub tests passed in the observed master run portion; no live mutation used | Writes return serialized success/error strings rather than a common evidence/result type; no approval resume integration for GitHub writes | **REUSE read operations**, **ADAPT writes** |
| Repository explorer | [`tools/repoIntelligence/repoExplorerTool.ts`](./tools/repoIntelligence/repoExplorerTool.ts) | Structured repository query tool | Exists as a tool boundary | Not proven part of the default native agent tool set | **ADAPT** |
| Change evidence | [`graph/changeEvidence.ts`](./graph/changeEvidence.ts), `graph/workspaceEvidence.test.ts` | Captures baseline and verifies proposed file changes and unexpected changes | Added/verified in Phase 1-era worktree; targeted evidence tests exist | Not a universal final verification contract across all tool types | **REUSE**, **ADAPT** |

### 2.6 Skills, persistence, and observability

| Subsystem | Real source files / entry points | Actual functionality | Integration status and evidence | Missing behavior | Recommendation |
|---|---|---|---|---|---|
| Skills | No repository source files or registry matched a skills implementation search | No verified runtime skill loader/progressive skill mechanism | No tests or entry point found | Skill manifest, selection, loading, versioning, and evidence | **MISSING** |
| Run persistence | `approvalRuntime`, `.aegis/runs/*.json`, repository JSON snapshots | Persists selected graph state and repository intelligence snapshots | Files are produced during tests/runs | No canonical run directory/schema, event append log, cleanup/retention, or reliable failure reporting | **ADAPT** |
| API lifecycle | [`apps/api/services/agentService.ts`](./apps/api/services/agentService.ts), API controllers/routes | Starts graph asynchronously and exposes API endpoints around projects/tasks/runs/approvals | Audit found API records and graph state are disconnected; API typecheck/build fails | Shared lifecycle, status subscription, approval ownership, result/evidence synchronization | **DEFER for V0**, **CONSOLIDATE later** |
| Web UI | `apps/web/app`, `apps/web/hooks`, `apps/web/lib/api.ts` | Next.js pages and API hooks, with some live hooks and some mock/static screens | Web build passed; live end-to-end product path unverified | Not needed for CLI-first V0; current mocks and duplicate trees remain | **DEFER**, **RETIRE LATER** duplicates |
| Logging/errors | Console logging, graph `errors`, tool structured errors, snapshot writes | Visible logs and state error arrays; tool failures generally surface | Tests verify several failure paths | Broad catches in persistence/ingestion can hide root failures; no structured event logger or correlation contract | **ADAPT** |

## 3. Actual Runtime Architecture

The verified architecture is not yet the architecture described by the product documents.

### 3.1 Existing CLI intelligence path

```text
cli.ts connect
  -> validateRepositoryAccess
  -> optional remote ingestion
  -> scanner
  -> AST/import/API/database/test/dependency extraction
  -> Git history + relationship graph
  -> JsonRepositoryStore (.gemini/.../repo_intelligence)
```

This is a real, reusable repository indexing path. `cli.ts search` and `impact` query snapshots through `queryRepositoryIntelligence`.

### 3.2 Existing CLI engineering path

```text
cli.ts run
  -> executeApprovalWorkflow
  -> planner
  -> researcher
  -> architect
  -> developer proposal
  -> approvalCheck
       -> pause and persist
       -> approve/reject command
  -> apply proposal
  -> tester / terminal
  -> reviewer
  -> result printed by CLI
```

The approval-aware graph is currently the best V0 starting point because it already has proposal/pause/resume semantics, controlled mutation, test execution, and targeted evidence. It is not yet a complete `INVESTIGATE`/`FIX` product because investigation is not a distinct read-only lifecycle and final security/final-verification stages are not consistently connected.

### 3.3 Existing demo path

```text
runDemo.ts
  -> multiAgentGraph
  -> planner -> researcher -> architect -> developer -> tester -> reviewer -> security
  -> optional real temporary workspace
```

This proves a useful orchestration mechanism and real I/O capability, but it is a second workflow and does not own the canonical CLI run lifecycle.

### 3.4 Existing API/web path

```text
web
  -> API controllers/hooks
  -> apps/api/services/agentService.ts
  -> executeApprovalWorkflow asynchronously
```

The audit established that API task/run/approval/file/event records are not synchronized with graph state. This is not a suitable V0 dependency.

## 4. Proposed Minimal V0 Architecture

V0 should be implemented as one CLI-first runtime, not as a new framework and not as a rewrite.

### 4.1 Canonical lifecycle

Use one persisted run lifecycle with these states:

```text
created
  -> investigating
  -> planned
  -> awaiting_approval
  -> executing
  -> verifying
  -> completed | failed | rejected
```

`INVESTIGATE` may terminate after evidence and an answer/plan. `FIX` continues through approval, mutation, testing, review, and final evidence.

The lifecycle should be represented by the existing `AegisState` plus a small, versioned run envelope. Do not create separate state stores for CLI, graph, and API.

### 4.2 One native execution runtime

The runtime should:

1. Resolve a workspace and repository snapshot.
2. Create/load a run record.
3. Select `INVESTIGATE` or `FIX`.
4. Provide bounded repository context to the agents.
5. Invoke the canonical graph or a small direct investigation route.
6. Route all tool calls through the existing guarded tool functions.
7. Persist meaningful events, approvals, tool results, test results, diffs, and final evidence.
8. Resume from a persisted approval exactly once.

The first implementation should use `approvalWorkflow.ts` as the execution backbone for `FIX`, rather than trying to merge every historical graph first.

### 4.3 Investigation path

Investigation should be read-only and should not enter the mutation approval path merely because a workspace exists. It should use:

- repository snapshot lookup;
- `queryRepositoryIntelligence`;
- safe filesystem reads;
- optional Git read commands;
- optional RAG/project knowledge context;
- researcher/reviewer-style reasoning;
- a structured answer containing findings, evidence paths/lines, uncertainty, and recommended next action.

No file writes, GitHub writes, terminal scripts, or generated proposal should occur in this mode.

### 4.4 Fix path

Use the existing approval-aware flow:

```text
task
  -> bounded investigation/context
  -> plan/proposal
  -> approval if mutation is required
  -> guarded apply
  -> detected test command
  -> review
  -> change/test/evidence verification
  -> durable result
```

The security agent can initially run as a final read-only review node or verification step. It should not be duplicated as another independent workflow.

### 4.5 Tool boundary

The existing filesystem and terminal tools should remain the policy boundary. Add only the minimum shared execution context needed to pass:

- run ID;
- workspace root;
- execution mode;
- approval decision;
- event/evidence sink.

Dangerous operations must remain blocked even after approval. Approval should only authorize a specific pending request and run.

### 4.6 Context and durable knowledge

Keep the stores conceptually separate:

- **Working context:** current run state, bounded source snippets, plans, tool outputs, test output, approval state.
- **Durable knowledge:** repository snapshots, architectural decisions, project preferences, learned facts.

Reuse JSON repository snapshots and long-term memory, but record references and provenance in the run rather than copying unbounded content into every prompt.

### 4.7 Lightweight skills

Do not build a skills framework for V0. Use a small static capability selection layer only if the first workflow proves it necessary. A V0 “skill” can be a prompt/context bundle selected by workflow mode, but it must not become a second agent registry or plugin system.

## 5. V0 Scope and Exclusions

### In scope

- CLI-first execution against a local repository.
- `INVESTIGATE` read-only workflow.
- `FIX` workflow with proposal, approval, controlled writes, tests, review, and evidence.
- Local repository intelligence indexing and retrieval.
- Gemini structured outputs with explicit Zod validation.
- Existing filesystem and terminal guardrails.
- Persisted run state and meaningful execution evidence.
- Deterministic tests plus one realistic local runtime demonstration.
- Clear failed/blocked/paused outcomes.

### Explicitly out of scope

- Rebuilding or polishing the web dashboard.
- Making the API package production-ready.
- GitHub mutation as a required V0 path.
- Browser automation.
- A general-purpose skills marketplace/registry.
- Multi-provider model abstraction.
- Distributed workers, queues, or hosted orchestration.
- Replacing LangGraph everywhere.
- Rewriting repository intelligence.
- Automatic learning loops or autonomous long-term policy changes.
- Destructive integration tests against real repositories.

## 6. Ordered Implementation Milestones

### Milestone 0 — Establish a passing V0 baseline

**User-visible capability:** None; establishes trustworthy starting conditions.

**Reuse:** Root build, targeted approval/terminal tests, repository-intelligence tests, existing CLI commands.

**Likely files:** `package.json`, root `tsconfig.json` only if strictly necessary; test runner configuration if an existing defect prevents deterministic completion.

**Necessary additions:** A documented validation command set; no architecture addition.

**Integration points:** Root build, targeted tests, CLI help/connect/search/status.

**Required tests:**

- `npm run build`
- targeted approval and terminal tests
- repository-intelligence tests
- complete root test run with a bounded timeout and explicit failure capture
- `npx tsx cli.ts --help`

**Runtime demonstration:** Connect a small local fixture repository, inspect status, and run a structural search.

**Completion criteria:** Root build and all relevant non-live tests complete; API failures are isolated and documented rather than hidden.

**Risks:** Existing generated artifacts and long-running GitHub tests can obscure results.

### Milestone 1 — Canonical persisted CLI run envelope

**User-visible capability:** `run` produces a stable run ID, status, state, and result that can be inspected after the process exits.

**Reuse:** `approvalRuntime`, `AegisState`, `.aegis/runs` snapshots, `cli.ts`.

**Likely files:** `graph/approvalWorkflow.ts`, `graph/state.ts`, `cli.ts`; possibly one small run persistence module only if the existing runtime cannot provide a clean envelope.

**Necessary additions:** Versioned run metadata and explicit lifecycle/event records; no second state store.

**Integration points:** Start, pause, approve/reject, completion, failure, run inspection.

**Required tests:** Start/pause/resume/reject/reload-after-process-boundary tests; approval ID/run ID mismatch tests; persistence failure tests.

**Runtime demonstration:** Start a mutating task, stop after the pause, approve from a new CLI process, inspect the final persisted result.

**Completion criteria:** One run can be resumed exactly once with durable status and evidence.

**Risks:** LangGraph checkpoint semantics and custom JSON snapshots can diverge; define the source of truth before implementation.

### Milestone 2 — `INVESTIGATE` read-only workflow

**User-visible capability:** `aegis investigate "<question>" --workspace <path>` returns an evidence-backed answer without writing files or running risky commands.

**Reuse:** `cli.ts`, repository intelligence scanner/store/retriever, `researcher` agent, RAG/project knowledge where useful, safe filesystem reads.

**Likely files:** `cli.ts`, `graph/state.ts`, researcher/context modules, repository retrieval modules, tests.

**Necessary additions:** Intent/mode selection and a structured investigation result with evidence and uncertainty.

**Integration points:** Snapshot lookup, bounded context assembly, Gemini structured output, run persistence.

**Required tests:** No-write/no-risky-tool test; known-symbol/query retrieval test; insufficient-evidence result; model/schema failure propagation.

**Runtime demonstration:** Ask where authentication is handled in a local repository and show file/line evidence.

**Completion criteria:** Investigation never enters mutation approval or apply code and returns reproducible evidence.

**Risks:** Heuristic retrieval may return weak matches; the result must say when evidence is insufficient.

### Milestone 3 — Trustworthy `FIX` proposal and approval

**User-visible capability:** A fix task produces a bounded proposal and pauses before mutation.

**Reuse:** Approval-aware graph, developer node, repository context discovery, structured Gemini output, guardrails.

**Likely files:** `graph/approvalWorkflow.ts`, developer node/agent, `cli.ts`, approval tests.

**Necessary additions:** Explicit proposal/evidence display and mode validation; do not add a replacement developer service.

**Integration points:** Investigation context → developer proposal → approval request → persisted run.

**Required tests:** Read-only task does not mutate; sensitive proposal pauses; approval is scoped to exact run/request; rejection does not run developer mutation; dangerous action remains blocked after approval.

**Runtime demonstration:** Fix a small local test or source defect in a fixture repository, inspect the proposal, and approve it from a second CLI invocation.

**Completion criteria:** The user can understand and approve the exact change before any write.

**Risks:** Current default graph can treat a non-empty workspace as mutating; intent classification must be explicit.

### Milestone 4 — Controlled apply, test, review, and evidence

**User-visible capability:** Approved changes are applied, tests run, review/security checks execute, and the result includes evidence.

**Reuse:** Filesystem, terminal, tester node, reviewer/security agents, `changeEvidence.ts`, execution logs.

**Likely files:** `graph/approvalWorkflow.ts`, tester/reviewer/security nodes, change evidence, run persistence, CLI rendering.

**Necessary additions:** A common evidence record for tool results, diff/change verification, test command/result, review findings, and final status.

**Integration points:** Apply → terminal/test → review/security → final verification → persisted result.

**Required tests:** Successful fix, failed test, timeout, blocked command, unexpected workspace change, reviewer rejection, missing test command, secret scrubbing.

**Runtime demonstration:** Apply a controlled change to a fixture repository, run its actual test command, and show the changed paths and test result.

**Completion criteria:** A successful result means verified repository state, not merely a successful model response.

**Risks:** Test commands can be long-running or project-specific; preserve timeout and explicit failure semantics.

### Milestone 5 — Evidence-first CLI UX and regression gate

**User-visible capability:** Users can inspect runs, approvals, changes, tests, errors, and evidence without reading raw JSON.

**Reuse:** `cli.ts` output, persisted run records, existing status/search/impact formatting.

**Likely files:** `cli.ts`, run/evidence types, targeted CLI tests.

**Necessary additions:** Minimal `run status`, `run show`, and result rendering; no web/API dependency.

**Integration points:** All prior lifecycle states and persisted records.

**Required tests:** CLI output contract tests and a complete local fixture demonstration.

**Runtime demonstration:** `investigate`, `run`, `approve`, `status/show` against the same fixture repository.

**Completion criteria:** A developer can reproduce and audit one complete workflow from CLI output and persisted evidence.

**Risks:** Formatting can become a second contract; keep machine-readable records alongside human output.

## 7. Verification Requirements

Every V0 milestone must provide:

1. A focused unit/integration test for the new behavior.
2. A negative-path test proving unsafe or invalid behavior is rejected.
3. A realistic local runtime demonstration using a fixture repository.
4. Persisted evidence that includes run ID, workspace/revision, selected mode, tool calls, approval decision, changed paths, command results, and final status.
5. Explicit distinction between:
   - model output;
   - requested tool action;
   - policy decision;
   - actual tool result;
   - verification result.

The V0 validation gate should include:

```text
npm run build
npx tsx <targeted investigation/fix tests>
npx tsx cli.ts --help
npx tsx cli.ts connect <fixture>
npx tsx cli.ts search <repoId> "<query>"
npx tsx cli.ts run "<task>" --workspace <fixture> --mode semi-auto
npx tsx cli.ts approve <runId> <approvalId> approve
```

The API and web builds should be reported separately. They must not be allowed to mask or block the CLI-first V0 gate unless V0 explicitly adopts those surfaces.

## 8. Risks and Unresolved Architectural Decisions

1. **Canonical graph choice:** The approval-aware graph is the best V0 base, but the multi-agent graph contains security and broader retry behavior. Decide whether to add those nodes to the approval graph or simplify the multi-agent graph into one canonical graph; do not maintain both as product paths.
2. **Run source of truth:** Choose whether the persisted run envelope or LangGraph checkpoint is authoritative, then make the other an implementation detail.
3. **Investigation intent:** A workspace path currently influences mutation policy. V0 needs explicit mode/intent rather than inferring mutation from workspace presence.
4. **Repository snapshot freshness:** Define revision identity and stale-snapshot behavior before relying on retrieval for fixes.
5. **Gemini model policy:** Current fallback model names and rate-limit handling are real but configuration-sensitive. Record model/version and failures in run evidence.
6. **Tool call loop depth:** `runToolAgent` supports one model tool-call round. It is reusable for simple tools, but V0 should not claim unrestricted autonomous tool use without a bounded loop and per-step evidence.
7. **TypeScript/API boundary:** API compilation remains broken around repository intelligence and TypeScript declarations. Do not expand API scope until the CLI runtime is trustworthy.
8. **Persistence error handling:** Broad catches in several persistence paths can convert storage failures into silent degradation. V0 must surface persistence failures explicitly.
9. **GitHub mutation:** Existing GitHub writes are guarded, but approval/lifecycle/evidence integration is not proven. Keep them out of the critical V0 path.
10. **Skills:** No runtime skills implementation exists. Avoid introducing one until a concrete repeated workflow needs progressive loading.
11. **Generated artifacts:** `.aegis/runs`, `.gemini` snapshots, `.tmp`, and build outputs make the worktree noisy. Define ownership and cleanup policy before claiming reproducible repository state.

## 9. Exact Recommended First Implementation Task

**Implement the canonical CLI run envelope and lifecycle adapter around the existing approval-aware workflow, without adding API/web integration.**

The first task should:

1. Define a versioned persisted run record containing run ID, mode (`INVESTIGATE`/`FIX`), workspace, repository snapshot/revision reference, lifecycle status, pending approval, approval decision, state summary, tool events, test results, change evidence, errors, and timestamps.
2. Make `executeApprovalWorkflow` and `resolveApprovalAndResume` write that record through one explicit persistence path.
3. Ensure approval resume loads the exact run, validates the exact pending approval, and cannot rerun proposal-generation nodes.
4. Add a minimal CLI command to inspect a persisted run by ID.
5. Add deterministic tests for start, pause, reload, approve, reject, failure, and persistence errors.
6. Demonstrate the lifecycle against a small local fixture repository without invoking paid APIs in automated tests.

Do **not** start by building skills, fixing the web dashboard, repairing the API package, adding another agent framework, or merging every historical workflow. Until one CLI run can be started, paused, resumed, verified, and inspected from durable evidence, those efforts would recreate the integration drift already identified by the audit.

