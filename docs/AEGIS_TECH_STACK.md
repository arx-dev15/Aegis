# AEGIS — Technology Architecture and Engineering Decisions

**Status:** Authoritative Architectural Standard  
**Target:** AEGIS V0 and Successive Development Lifecycles  
**Audience:** Human Engineers, Autonomous Coding Agents, Reviewers  

---

## 1. Executive Summary and Architectural Principles

AEGIS is an open, TypeScript-first, agent-agnostic software engineering harness designed for autonomous codebase navigation, reasoning, mutation, and verification.

This document establishes the permanent architectural foundations, technology choices, evaluation criteria, and lifecycle boundaries for AEGIS. The core philosophy is **Inspect → Understand → Reuse → Implement → Integrate → Verify**. Architecture novelties, duplicate abstractions, and premature migrations are strictly disallowed.

---

## 2. Decision Classifications

All technologies and architectural components in AEGIS are categorized under four explicit statuses:

- **LOCKED:** Non-negotiable architectural foundation or approved default. Cannot be replaced without an explicit, formal architecture decision record (ADR).
- **SELECTED:** Intended implementation choice. Represents the roadmap default when capabilities are built, but may not be fully installed in the repository today.
- **EVALUATE:** Candidate alternative requiring comparative evidence, benchmark parity, or demonstrated operational gaps before adoption.
- **DEFERRED:** Explicitly out of current priorities. Must not be introduced unless scale, multi-user, or distributed requirements demonstrably demand it.

---

## 3. Core Architectural Decisions

### A. Locked Architectural Foundations
These defaults form the bedrock of the AEGIS harness:
- **TypeScript:** Primary implementation language across the harness, tooling, and agents. Strict typing must be preserved.
- **Node.js LTS Runtime:** Standard execution runtime (Node.js 20+ / 22+).
- **npm:** Primary package manager for dependency resolution and script orchestration.
- **Zod:** Authoritative schema validation library for structured model outputs, runtime contracts, tool inputs, and state schemas.
- **Native Iterative Agent / Tool Loop:** Primary execution mechanism (`agents/agent.ts`), featuring iterative tool calling, observation recording, and bounded cycles.
- **Provider-Agnostic Model Adapters:** Abstract model interfaces preventing lock-in to any single AI vendor.
- **Google Gemini as Initial Model Provider:** Configured default model provider via `@google/genai` / `@langchain/google-genai`, strictly decoupled behind provider adapters.
- **Single Canonical Run & Approval Lifecycle:** Centralized execution and human-in-the-loop approval state machine (`graph/approvalWorkflow.ts`, `graph/state.ts`, `.aegis/runs/`). No secondary run stores or ad-hoc approval bypasses.
- **Consistent Guarded Tool Authorization Boundary:** All destructive operations (filesystem mutations, process executions, network requests) must pass through `tools/guardrails/` with explicit security policies and human approval gates.
- **Repository-Aware Context Engineering:** Structural repository analysis (`repo-intelligence/`) grounded in live-source inspection, AST analysis, symbol maps, and file hashes.
- **First-Class Execution Evidence:** Every change must capture pre-apply baselines, post-apply hashes, diffs, exit codes, and test outputs (`graph/changeEvidence.ts`). No success-shaped assertions or fabricated results.
- **CLI-First Development:** Primary developer experience centered on `cli.ts`, without excluding existing Express API (`apps/api`) or dashboard (`apps/web`) integrations.
- **Explicit Error States & Bounded Execution:** All agent loops and workflows enforce maximum iteration bounds, deterministic failure recovery, and fail-closed security.

### B. Agent and Workflow Architecture
- **Native Execution Baseline:** The existing `runToolAgent()` implementation (`agents/agent.ts`) serves as the active baseline for autonomous tool calling.
- **Agent SDK Evaluation Policy:** Frameworks like Vercel AI SDK or other mature agent engines are classified as **EVALUATE**. They may only replace or augment the native loop if benchmarked on identical tasks and demonstrated to provide superior reliability, multi-provider support, or lower maintenance overhead.
- **LangGraph as Optional Orchestrator:** LangGraph remains available for complex, durable, branching, or multi-phase orchestrations (such as approval pause/resume). It must not be mandated for simple, direct agent tasks.
- **Task-Adaptive Workflows:** The legacy fixed seven-agent waterfall pipeline (Planner → Researcher → Architect → Developer → Tester → Reviewer → Security) is maintained for backwards compatibility, but is **not** the mandated execution path. Future workflows must be task-adaptive:
  - `INVESTIGATE`: Read-only discovery, symbol tracing, hypothesis generation, and evidence gathering.
  - `FIX`: Defect localization, targeted patch proposal, approval pause, authorized mutation, and regression test verification.
  - `BUILD`: Multi-file feature synthesis, dependency addition, and integration testing.
  - `REVIEW` & `REFACTOR`: Quality inspection, architectural drift detection, and safe AST-guided code transformations.
- **Determinism vs. Reasoning:** Use deterministic algorithms for predictable operations (file walking, symbol extraction, test execution, hash verification) and reserve LLM calls for judgment, reasoning, synthesis, and repair.
- **No Competing Runtimes:** Do not create duplicate agent loops, parallel state stores, or competing execution graphs.

### C. Repository Intelligence
Repository understanding must prioritize fast, structural, and deterministic intelligence over heavyweight probabilistic systems:
- **TypeScript Compiler API (ts-morph / tsc):** Primary engine for deep AST parsing, symbol resolution, type hierarchies, and import/export graphs in TS/JS codebases.
- **Tree-sitter:** Selected technology for multilingual syntax parsing (Python, Go, Rust, Java, C/C++) across non-TypeScript repositories.
- **Language Server Protocol (LSP):** Selected integration point when semantic cross-file references and hover/definition capabilities add proven value.
- **ripgrep (rg):** High-speed regex and literal text search engine for code and text discovery.
- **Git Metadata & Diff Awareness:** Native Git inspection for commit histories, blame, unstaged diffs, and worktree baselines.
- **Bounded Live Source Reads:** Context gathering must read bounded snippets and compute SHA-256 hashes to guarantee freshness.
- **Semantic Retrieval & RAG:** Vector embeddings, semantic chunking, and similarity search are **optional supporting capabilities**. They must supplement, never replace, exact structural code search.
- **No Premature Graph or Vector DBs:** Dedicated graph databases (Neo4j) or dedicated vector databases (Pinecone, Qdrant, Milvus) are **DEFERRED**. File-backed indices and embedded search suffice for local workflows.

### D. Context, Skills, and Memory
- **Progressive Repository Skills:** Progressive context loading via repository-local `SKILL.md` instructions (located in `.aegis/skills/` or project roots) loaded on-demand per task.
- **Adaptive Context Selection:** Context must be selected dynamically based on task type, relevance, freshness, structural relationships, and token budgets.
- **Zero-Trust Instruction Model:** Skills, prompt instructions, issue descriptions, and tool outputs are untrusted external inputs. They can never grant authorization, bypass guardrails, or override approval policies.
- **Context Taxonomy:** The harness strictly distinguishes:
  1. *Transient Context:* Working memory within a single agent invocation.
  2. *Indexed Facts:* Structural AST maps, symbol tables, and repository snapshots.
  3. *Run Evidence:* Verifiable tool outputs, SHA-256 baselines, test exit codes, and diffs.
  4. *Durable Decisions:* Architecture decision records and persistent project rules.
- **Scoped Engineering Memory:** Persistent memory must be source-backed, scoped to project/file, revocable, supersedable, and capable of detecting staleness when underlying code changes. Model hallucinations or assumptions must never be persisted as verified facts.

### E. Tool Interoperability
- **Model Context Protocol (MCP):** The Model Context Protocol is the standard external tool integration standard for AEGIS.
- **Official TypeScript SDK:** Future MCP client integrations must use `@modelcontextprotocol/sdk` (TypeScript). Version compatibility must be verified prior to installation.
- **Unified Security Boundary for MCP:** MCP tools are untrusted external capabilities. They must be routed through AEGIS guardrails, logging, workspace containment, and human approval gates.
- **External Agent Delegation:** The harness must support delegating subtasks to external agents (e.g., specialized testing or documentation agents) via standard protocols without coupling to a proprietary agent cloud.
- **Safe Web Research:** Web search and documentation fetching are optional tools, restricted to read-only network access with strict domain and content boundaries.

### F. Execution and Security
- **Defense in Depth:** The security model consists of layered protections: Policy Engine → Workspace Containment → Human Approval Gate → Execution Enforcer.
- **Guarded Filesystem & Terminal Execution:** Existing capabilities in `tools/filesystem/` and `tools/terminal/` remain foundational.
- **Structured Command Invocation:** The preferred terminal execution interface is structured arguments (`[executable, ...args]`) rather than raw shell strings, minimizing shell-injection risks.
- **Approval Gates:** Sensitive actions (`sensitive-mutation`, file writes, package installations, branch modifications) require human approval before process spawning.
- **Workspace & Symlink Containment:** All paths must resolve within the target workspace root. Path traversal (`..`) and symlinks pointing outside the workspace must be rejected.
- **Secret Redaction:** High-entropy tokens, API keys, and environment secrets must be scrubbed from prompts, tool arguments, logs, and persisted runs.
- **Sandboxed Execution:** Untrusted code execution (tests, scripts, builds) must not run directly on the host in production:
  - **Docker:** Initial target for local containerized execution and sandbox isolation.
  - **MicroVMs (EVALUATE):** Technologies like Firecracker, Fly Machines, or gVisor for high-density, multi-tenant untrusted execution.
  - **Resource Bounds:** Execution must enforce CPU limits, memory caps, network restrictions, and hard execution timeouts.

### G. Persistence Architecture
- **Current Baseline:** Versioned JSON document persistence under `.aegis/runs/` for run states, checkpoints, approval requests, and evidence logs.
- **Local Transactional Persistence (EVALUATE):** SQLite (via `better-sqlite3`) is the selected evaluation target for complex local state, high-frequency event streaming, and concurrent task coordination.
- **Multi-User Services (SELECTED for Server):** PostgreSQL for centralized multi-tenant deployments, teams, and API storage.
- **No Premature Migrations:** Existing file-based JSON persistence must be preserved until transactional requirements or performance limits explicitly require a database. All database migrations must preserve backward compatibility with existing run records.

### H. Verification, Quality, and Observability
- **TypeScript Test Suites:** Existing custom runners and TypeScript test files (`testAll.ts`, `*.test.ts`) remain fully supported.
- **Vitest (SELECTED):** Preferred standardized test runner for future incremental test development and fast watch-mode testing. Passing custom test suites will not be churned merely to fit Vitest.
- **Disposable Fixtures:** All integration and acceptance tests must validate against disposable, isolated git repositories outside the AEGIS source tree.
- **Fail-Closed Verification:** A patch is only considered verified if:
  1. Filesystem diff matches the approved proposal.
  2. Untouched files remain bit-for-bit unchanged.
  3. Pre-existing failing tests pass with exit code 0.
  4. Evidence is recorded in the run record.
  If a patch applies but tests fail, the run status must be `unverified` or `failed`. Never report fabricated success.
- **OpenTelemetry (SELECTED):** Standard for structured distributed tracing, span generation, and metrics across agent loops.
- **AI Tracing (EVALUATE):** Langfuse or OpenInference for optional visual prompt inspection and LLM observability.

### I. Interface, Integration, and Delivery
- **Interactive CLI (Primary):** The CLI (`cli.ts`) is the primary developer interface for local engineers.
- **Terminal UI (EVALUATE):** Ink (`ink` + React) for rich interactive terminal experiences (split views, diff inspection, approval prompts).
- **Web Dashboard & REST API:** The existing Next.js dashboard (`apps/web`) and Express API (`apps/api`) remain supported product surfaces. Future work will align their lifecycles with the canonical run store.
- **Browser Engineering Verification (SELECTED):** Playwright for end-to-end browser testing and UI regression verification.
- **Containerization & CI/CD:** Docker for containerized local development; GitHub Actions for automated regression suites.
- **Cloud Target:** AWS (ECS/EKS, Lambda, S3, RDS) is the preferred future cloud deployment target, but is not a requirement for V0 local development.

### J. Explicitly Deferred Technologies
The following technologies are explicitly **DEFERRED** and must not be added to the project without demonstrated necessity:
- **Kubernetes:** Overkill for local development and single-tenant workloads.
- **Redis / Distributed Queues:** Premature until multi-worker distributed scheduling is required.
- **Separate Graph Databases (Neo4j):** ASTs and in-memory relationship graphs satisfy repository intelligence needs.
- **Dedicated Vector Databases (Pinecone/Milvus):** File-based or embedded vector stores are sufficient.
- **Python Microservices:** Avoid introducing a Python runtime; keep the stack TypeScript-first.
- **Heavyweight Memory Frameworks (MemGPT/Letta):** AEGIS uses scoped, source-backed engineering memory.
- **Premature Microservices:** All core services remain cohesive within the monorepo structure.

---

## 4. Technology Decision Matrix

| Subsystem / Technology | Current Status in AEGIS | Classification | Architectural Rationale & Next Steps |
|---|---|---|---|
| **TypeScript** | Implemented (Root & Apps) | **LOCKED** | Foundation language; strict typing and safety. |
| **Node.js LTS** | Implemented (v20/v22) | **LOCKED** | Foundation runtime for all execution. |
| **npm** | Implemented | **LOCKED** | Authoritative package manager. |
| **Zod** | Implemented (`zod` v4) | **LOCKED** | Contract definition and model output validation. |
| **Native Agent Loop** | Implemented (`agents/agent.ts`) | **LOCKED** | Active baseline for iterative tool calling. |
| **Google Gemini API** | Implemented (`models/gemini/`) | **LOCKED** | Configured default model provider; decoupled behind adapters. |
| **Approval Lifecycle** | Implemented (`graph/approvalWorkflow.ts`) | **LOCKED** | Single canonical state machine for human approvals and runs. |
| **Guarded Tools** | Implemented (`tools/guardrails/`) | **LOCKED** | Central authorization, path containment, and execution policies. |
| **Workspace Evidence** | Implemented (`graph/changeEvidence.ts`) | **LOCKED** | Hash baselines, diff tracking, and verified test outcomes. |
| **LangGraph** | Implemented (`@langchain/langgraph`) | **LOCKED** | Orchestration for complex, durable, or resumable workflows. |
| **Vercel AI SDK** | Not Installed | **EVALUATE** | Benchmark against native loop before considering adoption. |
| **TypeScript Compiler API** | Implemented (`repo-intelligence/`) | **LOCKED** | Core engine for TS AST, symbol, and relationship extraction. |
| **Tree-sitter** | Not Installed | **SELECTED** | Target engine for multilingual repository parsing. |
| **ripgrep** | Implemented (`tools/investigation/`) | **LOCKED** | Fast code and text search across workspaces. |
| **LSP Client** | Not Installed | **SELECTED** | For semantic resolution in non-TS or complex environments. |
| **Model Context Protocol (MCP)**| Architecture Defined | **SELECTED** | Target external tool protocol via `@modelcontextprotocol/sdk`. |
| **Docker Sandboxing** | Not Integrated | **SELECTED** | Target containerization for isolated test/code execution. |
| **MicroVMs (Firecracker)**| Not Integrated | **EVALUATE** | Candidate for production multi-tenant code isolation. |
| **JSON Run Persistence** | Implemented (`.aegis/runs/`) | **LOCKED** | Current reliable disk persistence for runs and approvals. |
| **SQLite (better-sqlite3)** | Not Installed | **EVALUATE** | Candidate for high-throughput local structured state. |
| **PostgreSQL** | Not Integrated | **SELECTED** | Intended database for multi-user server / API deployments. |
| **Vitest** | Not Installed | **SELECTED** | Preferred standardized test runner for future suites. |
| **OpenTelemetry** | Not Installed | **SELECTED** | Preferred distributed tracing and metrics standard. |
| **Langfuse** | Not Installed | **EVALUATE** | Optional AI prompt and execution tracing UI. |
| **Ink (Terminal UI)** | Not Installed | **EVALUATE** | Candidate for interactive terminal interfaces. |
| **Playwright** | Not Installed | **SELECTED** | Target for browser-based engineering verification. |
| **Express API** | Implemented (`apps/api/`) | **LOCKED** | Supported API surface; to be integrated with canonical runs. |
| **Next.js Dashboard** | Implemented (`apps/web/`) | **LOCKED** | Supported Web surface; to be integrated with canonical runs. |
| **Kubernetes** | None | **DEFERRED** | Unnecessary operational overhead for V0. |
| **Vector Databases (Cloud)**| None | **DEFERRED** | File-backed or embedded search is sufficient. |
| **Python Microservices** | None | **DEFERRED** | Violates TypeScript-first architectural cohesion. |

---

## 5. Technology Upgrade and Modification Policy

Architectural quality, stability, and verifiable evidence take precedence over adherence to any specific library or tool.

Before any locked or selected technology may be replaced or a new core dependency introduced, the change must satisfy the following **Six-Step Evaluation Criteria**:

1. **Demonstrated Limitation:** Prove an existing capability gap, reliability defect, or operational bottleneck in the current implementation.
2. **Comparative Benchmark:** Compare the candidate against the current implementation across identical engineering tasks and workloads.
3. **Security & Guardrail Implications:** Verify that the candidate respects workspace containment, authorization policies, secret redaction, and approval gates.
4. **Migration & Compatibility:** Detail how existing run records, APIs, and CLI workflows will be preserved without breaking changes.
5. **Measurable Verification:** Define concrete acceptance tests and exit criteria that validate the upgrade.
6. **Bounded Implementation Plan:** Execute the change in a single, targeted pull request or milestone without broad system disruption.

Dependency versions are not frozen permanently; stable supported releases must be verified for compatibility prior to installation.
