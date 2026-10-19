# AEGIS V0 — Developer-Grade Product Scope and Release Criteria

**Status:** Authoritative Product Specification & Release Criteria  
**Target:** AEGIS V0 Milestone  
**Maturity Level:** Developer-Grade Engineering Harness (Not an MVP or Proof of Concept)  

---

## 1. Executive Purpose & Quality Standard

AEGIS V0 is an autonomous, developer-grade software engineering harness for real-world software maintenance and development. It is engineered to perform substantial, dependable engineering work across multi-file codebases while maintaining ironclad safety controls, human oversight, and verifiable outcomes.

### Core Release Standard:
- **Target Success Rate:** Aspiration of **50–70% independently verified pass rate** across a representative, held-out evaluation benchmark of everyday engineering tasks.
- **Verification Rule:** **Never claim this success rate until empirically measured.** No simulated or "success-shaped" outcomes are permitted.
- **Quality Over Feature Breadth:** Engineering rigor, strict error handling, non-destructive mutation safety, and verified tests take precedence over superficial feature count.
- **Scope Boundary:** Complex hosted multi-user management, distributed worker queues, and enterprise cloud infrastructure remain deferred to post-V0 releases, ensuring maximum local developer utility.

### Implementation Status Classifications:
To ensure uncompromising accuracy, every capability is evaluated against active source code and executable tests using five standardized classifications:
1. **Implemented and verified through actual runtime integration:** Tested and working in active system code.
2. **Verified only through deterministic/offline fixtures:** Execution path and integration logic proven via deterministic or offline mocks; live-model autonomous reasoning remains unverified.
3. **Partially implemented:** Subsystem components exist and pass isolated tests, but end-to-end integration or specific sub-capabilities remain incomplete.
4. **Architecture selected but not implemented:** Architectural decision locked and dependency chosen, but not installed or coded in the repository.
5. **Unverified:** Unproven against executable tests.

---

## 2. The 15 Core V0 Capabilities

Below is the definitive specification for the 15 capabilities required for the AEGIS V0 release.

---

### Capability 1: Native Iterative Coding Agent with Multi-Step Tool Use
- **Expected User-Visible Behavior:** The agent accepts complex developer goals, initiates multi-step reasoning loops, selects and executes tools iteratively, interprets intermediate observations, and converges on an evidence-backed resolution without premature stopping.
- **Minimum Quality & Safety Requirements:** Bounded iteration loop (configurable max turns, default 15). Strict token budgeting, loop detection, and fail-closed error handling.
- **Integration Dependencies:** `agents/agent.ts`, `models/gemini/model.ts`, `tools/guardrails/`.
- **Acceptance Test / Release Gate:** Multi-turn loop solves a 3-step investigation task requiring discovery, symbol read, and hypothesis generation with zero crashes.
- **Current Implementation Status:** **Verified only through deterministic/offline fixtures (Live model unverified).**
- **Evidence & Verification Notes:** The iterative tool-calling loop (`runToolAgent()` in `agents/agent.ts`) is implemented and verified with offline deterministic mock models in `agents/agent.test.ts`. Autonomous multi-turn reasoning and tool selection on complex tasks against live model APIs remain unverified.

---

### Capability 2: Repository Intelligence and Multilingual Code Navigation
- **Expected User-Visible Behavior:** Fast discovery and indexing of project structures, symbol definitions, import/export call graphs, dependencies, and git history across TypeScript/JavaScript and multilingual codebases.
- **Minimum Quality & Safety Requirements:** Instant search via ripgrep; zero full-repo memory bloat; bounded live file reads; fallback to tree-sitter/regex for non-TS languages.
- **Integration Dependencies:** `repo-intelligence/`, `tools/investigation/`, ripgrep.
- **Acceptance Test / Release Gate:** Accurately identifies caller/callee hierarchy across 50+ files within < 2 seconds.
- **Current Implementation Status:** **Partially implemented.**
- **Evidence & Verification Notes:** Deep TypeScript AST indexing, symbol extraction, import/export relationship maps (`repo-intelligence/`), and ripgrep search are implemented and verified in the master test suite. However, multilingual Tree-sitter integration and Language Server Protocol (LSP) semantic resolution are **Architecture selected but not implemented**. Existing TypeScript intelligence does not establish multilingual capability.

---

### Capability 3: Adaptive Context Engineering and Progressive Skills
- **Expected User-Visible Behavior:** Dynamically loads concise, relevant codebase facts and on-demand repository-local skills (`.aegis/skills/*/SKILL.md`) without polluting the context window with raw dumps.
- **Minimum Quality & Safety Requirements:** Context budget limits; relevance scoring; all loaded skills treated as untrusted instructions incapable of escalating permissions.
- **Integration Dependencies:** `repo-intelligence/retrieval/`, `.aegis/skills/`.
- **Acceptance Test / Release Gate:** Successfully matches and loads task-relevant skill guidelines and executes the prescribed diagnostic workflow.
- **Current Implementation Status:** **Partially implemented.**
- **Evidence & Verification Notes:** The hybrid context retrieval engine with token budgeting is implemented in `repo-intelligence/retrieval/`. The repository-local skill specification is defined under `.aegis/skills/`, but dynamic on-demand skill discovery, matching, and injection into the active agent loop are not yet integrated.

---

### Capability 4: Evidence-Backed INVESTIGATE Workflow
- **Expected User-Visible Behavior:** Dedicated read-only CLI command (`npx tsx cli.ts investigate "<query>"`) that diagnoses issues, locates bug sites, inspects failing tests, and outputs structured findings with exact file/line provenance without modifying disk.
- **Minimum Quality & Safety Requirements:** Strict read-only enforcement. Zero filesystem mutations allowed. Every assertion backed by captured observations.
- **Integration Dependencies:** `cli.ts`, `agents/agent.ts`, `tools/investigation/`, `tools/guardrails/`.
- **Acceptance Test / Release Gate:** Accurately diagnoses a real logic bug in an external fixture, cites exact line numbers, and confirms 0 bytes written to disk.
- **Current Implementation Status:** **Verified only through deterministic/offline fixtures (Live model unverified).**
- **Evidence & Verification Notes:** The read-only investigation pipeline is fully integrated in `cli.ts` and verified via acceptance tests using deterministic tool observations. Live model diagnosis on novel defect patterns without provider injection remains unverified.

---

### Capability 5: Controlled FIX with Approval, Application, and Verification
- **Expected User-Visible Behavior:** Dedicated CLI repair command (`npx tsx cli.ts fix "<issue>"`) that investigates defects, proposes structured `CodeChange` objects, pauses for human approval, applies changes upon authorization, and verifies against regression tests.
- **Minimum Quality & Safety Requirements:** Pre-apply baseline capture; atomic patch application; stale workspace detection; multi-process approval resume; post-apply test execution.
- **Integration Dependencies:** `cli.ts`, `graph/approvalWorkflow.ts`, `graph/changeEvidence.ts`, `tools/filesystem/`.
- **Acceptance Test / Release Gate:** Failing test → native investigation → proposal → approval pause → second CLI process approval → mutation → passing test → verified evidence.
- **Current Implementation Status:** **Verified only through deterministic/offline fixtures (Live model unverified).**
- **Evidence & Verification Notes:** The full mechanical lifecycle (investigation, proposal generation, approval pause, cross-process approval resume, authorized mutation, post-apply test execution, and run evidence recording) was proven in `native-fix-real-bug.acceptance.test.ts` (6/6 checks passing). However, this was demonstrated using an offline deterministic adapter on a disposable fixture repository. Autonomous real-model reasoning, bug localization, and patch generation without provider injection remain unverified against live model APIs.

---

### Capability 6: BUILD and Multi-File Feature Implementation
- **Expected User-Visible Behavior:** Implements new features, adds endpoints or functions spanning multiple files, creates new modules, and updates configuration in accordance with an architectural plan.
- **Minimum Quality & Safety Requirements:** Atomic multi-file proposal review; dependency verification; compiler validation (`tsc`) before reporting completion.
- **Integration Dependencies:** `graph/approvalWorkflow.ts`, `tools/filesystem/`, `agents/developer/`, `agents/architect/`.
- **Acceptance Test / Release Gate:** Implements a new multi-file service with unit tests in a clean fixture repository; builds and passes all tests.
- **Current Implementation Status:** **Partially implemented (Autonomous workflow unverified).**
- **Evidence & Verification Notes:** Multi-file changes are supported in state representations (`CodeChange[]`) and the legacy multi-agent graph (`graph/multiAgentWorkflow.ts`), but an autonomous end-to-end multi-file build workflow with compiler validation loops has not been demonstrated in an integrated acceptance benchmark.

---

### Capability 7: REVIEW and REFACTOR Workflows
- **Expected User-Visible Behavior:** Analyzes proposed or staged code changes for security vulnerabilities, style drift, anti-patterns, and regressions; executes automated refactoring with AST precision.
- **Minimum Quality & Safety Requirements:** AST-guided transformation; strict preservation of existing unit test passing status; non-breaking public API signatures.
- **Integration Dependencies:** `agents/reviewer/`, `agents/security/`, `repo-intelligence/`.
- **Acceptance Test / Release Gate:** Proposes clean refactor of a complex function; passes 100% of existing unit tests without behavior alteration.
- **Current Implementation Status:** **Partially implemented.**
- **Evidence & Verification Notes:** Specialized Reviewer and Security agent roles exist and pass isolated tests in `agents/reviewer/` and `agents/security/`. Standalone CLI commands (`cli.ts review`, `cli.ts refactor`) and automated AST-guided transformations are not implemented.

---

### Capability 8: Native Test → Observe → Revise Loops with Strict Retry Limits
- **Expected User-Visible Behavior:** When an applied patch causes test or build failures, the agent observes the error output, formulates a corrective hypothesis, generates an updated patch, and re-tests.
- **Minimum Quality & Safety Requirements:** Hard limit on fix attempts (max 3 retries); fail-closed termination if looping persists; full recovery history logged.
- **Integration Dependencies:** `graph/approvalWorkflow.ts` (`recoveryNode`), `tools/terminal/`.
- **Acceptance Test / Release Gate:** Agent successfully repairs its own syntax or assertion error on attempt 2 and verifies passing test suite.
- **Current Implementation Status:** **Partially implemented (Complete autonomous repair iteration not demonstrated).**
- **Evidence & Verification Notes:** Post-apply test execution exists in the FIX workflow, and the LangGraph `recoveryNode` handles error transitions in unit tests (`graph/failureRecovery.test.ts`). However, an integrated native agent loop that autonomously parses live test failure output, formulates a revised proposal, re-submits through approval/apply, and iterates within strict limits is not yet demonstrated.

---

### Capability 9: Safe and Isolated Execution Environment
- **Expected User-Visible Behavior:** All untrusted commands, test runners, and builds execute within guarded sandboxes with strict resource and path limits.
- **Minimum Quality & Safety Requirements:** Workspace boundary enforcement; directory escape prevention; secret and credential scrubbing; Docker containerization for untrusted execution.
- **Integration Dependencies:** `tools/guardrails/`, `tools/terminal/`, Docker runtime.
- **Acceptance Test / Release Gate:** Command attempting to navigate to parent directories (`../../etc/passwd`) or run malicious shell expansions is blocked before process execution.
- **Current Implementation Status:** **Partially implemented (Guarded host execution verified; Isolated sandboxing selected but not implemented).**
- **Evidence & Verification Notes:** Host-level guardrails (`tools/guardrails/`), workspace path traversal containment, command classification policy (allow/block/approve in `graph/terminalWorkflow.test.ts`), and secret redaction are implemented and verified. However, **guarded host execution is not equivalent to isolated Docker/microVM execution**. Container-level sandboxing remains an architecture selected target, not an active runtime isolation boundary.

---

### Capability 10: Persistent Sessions, Run Inspection, Pause/Resume, and Cancellation
- **Expected User-Visible Behavior:** Every execution receives a unique Run ID. Workflows can be inspected (`npx tsx cli.ts status <runId>`), paused at approval gates, resumed across independent CLI sessions, or cancelled safely.
- **Minimum Quality & Safety Requirements:** Atomic filesystem persistence in `.aegis/runs/`; concurrency locks preventing simultaneous duplicate resumes; clean cleanup on SIGINT/SIGTERM.
- **Integration Dependencies:** `graph/approvalWorkflow.ts`, `cli.ts`.
- **Acceptance Test / Release Gate:** A paused run is resumed by a separate OS process 1 hour later using only persisted disk state.
- **Current Implementation Status:** **Partially implemented (Persistent runs verified; Full session restoration unverified).**
- **Evidence & Verification Notes:** Atomic JSON run persistence, approval locking, and cross-process approval resumption are verified in `native-fix-real-bug.acceptance.test.ts`. However, **persistent runs and cross-process approvals do not establish full interactive session restoration**. Multi-turn conversational context rehydration and session restoration across arbitrary commands are not yet implemented.

---

### Capability 11: Meaningful Approval, Patch-Preview, and Execution Interfaces
- **Expected User-Visible Behavior:** Before approving any change, developers inspect clear unified diff previews, security classifications, affected files, and execution commands in the terminal or web UI.
- **Minimum Quality & Safety Requirements:** Diffs must precisely reflect disk modifications; clear categorization of actions (ADD, MODIFY, DELETE, EXECUTE); rejection leaves zero residue.
- **Integration Dependencies:** `graph/changeEvidence.ts`, `cli.ts`, `apps/web/`.
- **Acceptance Test / Release Gate:** Visual or terminal diff matches byte-for-byte with actual disk writes upon approval.
- **Current Implementation Status:** **Partially implemented (Basic CLI proposal display verified; Interactive preview & rich UI selected but not implemented).**
- **Evidence & Verification Notes:** The CLI prints file paths, change actions, and summaries prior to approval prompts. However, **basic commands do not establish interactive previews, streamed approvals, or polished terminal UI**. Full-color interactive unified diff inspection and Ink-based terminal UI remain selected architectural candidates.

---

### Capability 12: MCP Integration and Extensible Tooling
- **Expected User-Visible Behavior:** Plug-and-play addition of external Model Context Protocol (MCP) servers (e.g., PostgreSQL inspectors, external linters, issue trackers) via standard configuration.
- **Minimum Quality & Safety Requirements:** Strict sandboxing; MCP tool calls subject to standard AEGIS guardrail validation and approval policies; fail-soft on tool server disconnects.
- **Integration Dependencies:** `@modelcontextprotocol/sdk`, `tools/guardrails/`.
- **Acceptance Test / Release Gate:** Connects to a standard MCP test server, lists tools, executes a query, and captures output in the run evidence.
- **Current Implementation Status:** **Architecture selected but not implemented.**
- **Evidence & Verification Notes:** MCP is locked as the external tool protocol in `docs/AEGIS_TECH_STACK.md`, but `@modelcontextprotocol/sdk` is not yet installed or integrated into AEGIS runtime code.

---

### Capability 13: Optional External Research and Browser Testing
- **Expected User-Visible Behavior:** Ability to query web documentation for updated library APIs and execute headless browser tests (Playwright) to verify web UI changes.
- **Minimum Quality & Safety Requirements:** Strict domain allowlists; read-only web fetching; bounded page snapshots; timeouts on headless browser runs.
- **Integration Dependencies:** Headless browser runner / Playwright, HTTP client.
- **Acceptance Test / Release Gate:** Agent reads official documentation page for a library update and corrects an outdated API call.
- **Current Implementation Status:** **Architecture selected but not implemented.**
- **Evidence & Verification Notes:** Web research and Playwright browser verification are selected roadmap choices, but neither is currently installed or integrated in the harness.

---

### Capability 14: Source-Backed Project Engineering Memory
- **Expected User-Visible Behavior:** Preserves architectural conventions, dependency decisions, and discovered bug patterns across sessions, allowing the agent to remember project idiosyncrasies.
- **Minimum Quality & Safety Requirements:** Every memory entry must point to concrete source files, commit hashes, or explicit ADR documents; automated staleness invalidation when source changes.
- **Integration Dependencies:** `memory/`, `repo-intelligence/`.
- **Acceptance Test / Release Gate:** Agent retrieves a previously learned project convention and follows it during code synthesis without being prompted.
- **Current Implementation Status:** **Partially implemented.**
- **Evidence & Verification Notes:** Core memory storage and retrieval modules are implemented and pass unit tests (`memory/memory.test.ts`). Automatic source-staleness detection, commit-hash anchoring, and ADR linking remain to be completed.

---

### Capability 15: Instrumentation, Evaluation, and Regression Benchmarks
- **Expected User-Visible Behavior:** Standardized benchmark runner that evaluates AEGIS across held-out engineering tasks, measuring pass rates, token costs, time-to-fix, and regression status.
- **Minimum Quality & Safety Requirements:** Deterministic test fixtures; reproducible scoring; zero data leakage into agent prompts; OpenTelemetry tracing.
- **Integration Dependencies:** Benchmark harness, OpenTelemetry, disposable test fixtures.
- **Acceptance Test / Release Gate:** Full automated run across a 20-task benchmark producing a verified scorecard with zero manual interventions.
- **Current Implementation Status:** **Partially implemented (Harness demonstrated; Benchmark matrix selected but not implemented).**
- **Evidence & Verification Notes:** The disposable fixture acceptance testing pattern is proven in `native-fix-real-bug.acceptance.test.ts`. The complete 25-task evaluation matrix, OpenTelemetry instrumentation, and automated evaluation pipeline remain to be implemented.

---

## 3. Held-Out Evaluation Task Suite Specification

To validate the **50–70% release criteria** honestly, AEGIS V0 will be benchmarked against a held-out suite of **25 representative engineering tasks** spanning 9 core task types:

| Task Category | Count | Representative Task Description | Verification Gate |
|---|---|---|---|
| **1. Basic Logic Bugs** | 3 | Single-file calculation errors, off-by-one errors, falsy check bugs. | Pre-fix failing test passes exit 0 post-fix. |
| **2. Multi-File Bugs** | 3 | Type contract mismatches, shared interface drift across 3+ files. | Regression test passes; zero unrelated file modifications. |
| **3. Feature Development** | 3 | Implement a new REST endpoint or service method with tests. | New unit and integration tests pass; builds with `tsc`. |
| **4. API & Database Changes** | 3 | Schema migration, query update, DTO validation update. | Migration applies cleanly; query tests pass. |
| **5. Codebase Refactoring** | 3 | Extract common utility, rename domain symbol across 15+ files. | 100% of existing tests pass without behavioral changes. |
| **6. Codebase Investigation** | 3 | Identify source of memory leak or race condition; produce report. | Report cites exact line numbers and root cause. |
| **7. Test Repair** | 3 | Update stale tests broken by intentional API change without breaking app. | Test suite passes with valid assertions. |
| **8. Error Handling** | 2 | Add resilient error boundaries, retries, and typed exceptions. | Negative tests verify graceful failure. |
| **9. Realistic Constraints** | 2 | Solve tasks under strict linting, immutable vendor directories, and read-only files. | All linter rules pass; vendor files untouched. |

---

## 4. Release Checklist and Exit Criteria

AEGIS V0 will be declared officially released when all following criteria are satisfied:

1. **Benchmark Release Gate:** Demonstrates ≥ 50% verified pass rate on the 25-task held-out evaluation suite using live model APIs (not offline deterministic adapters).
2. **Live-Model FIX & Multi-Turn Reasoning:** Autonomous defect diagnosis, patch generation, and post-apply verification demonstrated end-to-end without provider injection.
3. **Native Autonomous Repair Iteration:** Closed test → observe → revise loop verified on real test failures with bounded retries.
4. **Containerized Sandbox Isolation:** Untrusted test execution, command running, and build execution moved from guarded host execution to isolated Docker/container sandboxes.
5. **Multi-Process Approval & Audit Trail:** Complete separation of proposal and approval processes verified with replay protection, stale baseline rejection, and diff verification.
6. **Repository Intelligence Expansion:** Tree-sitter multilingual parsing integrated alongside TypeScript Compiler API.
7. **Standardized Tool & UI Layer:** Official Model Context Protocol (MCP) SDK integrated under AEGIS guardrails; interactive diff previews in terminal CLI.
8. **Clean Builds & Master Test Suite:** Zero TypeScript compilation errors (`npm run build`) and 100% passing test suites (`testAll.ts`).
