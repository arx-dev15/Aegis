# Aegis Essential Capabilities Roadmap

This document lists the core capabilities that define **Aegis** as an AI Engineering Operating System. Each item is explicitly labeled with its implementation status.

---

## 1. Core Platform & Workspace Capabilities

### 1.1 Project Workspace & Understanding `[COMPLETED]`
Aegis inspects codebases, parses AST symbols, builds relationship graphs, and classifies files into an evidence-backed model before taking engineering action.

### 1.2 Multi-Agent Orchestration `[COMPLETED]`
Aegis deploys 7 specialized engineering agents (Planner, Researcher, Architect, Developer, Tester, Reviewer, Security) managed by a LangGraph StateGraph orchestrator with dynamic handoff and failure recovery loops.

### 1.3 Repository Intelligence & Impact Analysis `[COMPLETED]`
Extracts Express/Next.js API routes, SQL/Prisma schemas, manifest dependencies, and AST symbol relationships (`CALLS`, `IMPORTS`, `USES`). Computes dynamic impact reports (`computeDynamicImpactReport`) to calculate blast radius before making code changes.

### 1.4 Codebase-Aware RAG Pipeline `[COMPLETED]`
Deterministic sliding-window text chunking, Gemini embeddings (`gemini-embedding-001`), and cosine similarity vector search (`rag/projectKnowledge.ts`) for context injection.

### 1.5 Dual Memory System `[COMPLETED]`
Execution-isolated short-term working scratchpad (`runId`) and file-backed persistent long-term memory (`memory/long-term/storage.json`) for retaining project facts and architectural decisions across process restarts.

### 1.6 Safety, Policy Guardrails & Human-in-the-Loop `[COMPLETED]`
Direct low-level tool enforcement (`tools/guardrails/`) blocking dangerous actions (`rm -rf /`) and graph interruption (`status: "paused"`) requiring explicit human approval before executing sensitive file, terminal, or GitHub mutations.

### 1.7 Real GitHub Integration `[COMPLETED]`
Live REST integration (`tools/github/`) using `api.github.com` with `GITHUB_TOKEN` from `.env` and credential masking. No fake or mock production data.

### 1.8 Interactive CLI & REST API Gateway `[COMPLETED]`
First-class interactive command-line tool (`cli.ts`) and Express REST API server (`apps/api/`) exposing repository connection, status, search, and impact analysis capabilities.

---

## 2. In-Progress & Planned Essential Capabilities

### 2.1 Terminal & Sandbox Execution `[IN PROGRESS]`
Sandboxed runner for executing `npm test`, `npm run build`, and `git diff` commands securely inside controlled environments (`tools/terminal/`).

### 2.2 Model Context Protocol (MCP) Integration `[PLANNED]`
Standardized Model Context Protocol server/client interface (`tools/mcp/`) enabling seamless tool and context integration across external services.

### 2.3 Session Runtime, Checkpointing & Branching `[PLANNED]`
Persistent session state checkpoints allowing execution history reconstruction, task branching, and rewinding (`graph/checkpointing/`).

### 2.4 Observability, Tracing & Token/Cost Tracking `[PLANNED]`
Detailed execution tracing tracking agent runs, LLM latency, token counts, tool calls, and monetary costs (`observability/`).

### 2.5 Agent Evaluation & Benchmarks `[PLANNED]`
Automated benchmark suite measuring planning accuracy, retrieval precision, code correctness, and trajectory success (`evaluation/`).

### 2.6 Architecture Simplification & Refactor `[PLANNED]`
Post-stability consolidation to reduce file fragmentation and simplify imports while preserving 100% of capabilities, APIs, and tests.

---

## 3. Implementation Status Matrix

| Capability | Status | Core Component |
| :--- | :--- | :--- |
| Multi-Agent System (7 Agents) | `[COMPLETED]` | `agents/` |
| LangGraph Workflow Orchestration | `[COMPLETED]` | `graph/` |
| Dynamic Routing & Failure Recovery | `[COMPLETED]` | `graph/edges/agentRouter.ts`, `graph/nodes/recoveryNode.ts` |
| Repository Intelligence Engine | `[COMPLETED]` | `repo-intelligence/` |
| Codebase-Aware RAG | `[COMPLETED]` | `rag/` |
| Dual Memory (Short & Long Term) | `[COMPLETED]` | `memory/` |
| Policy Guardrails & Safety | `[COMPLETED]` | `tools/guardrails/` |
| Human-in-the-Loop Approvals | `[COMPLETED]` | `graph/approvalWorkflow.ts` |
| Real GitHub Integration | `[COMPLETED]` | `tools/github/` |
| Interactive CLI | `[COMPLETED]` | `cli.ts` |
| Express API & Web Dashboard | `[COMPLETED]` | `apps/api/`, `apps/web/` |
| Terminal / Sandbox Execution | `[IN PROGRESS]` | `tools/terminal/` |
| MCP Integration | `[PLANNED]` | `tools/mcp/` |
| Session Resume & Branching | `[PLANNED]` | `graph/checkpointing/` |
| Observability & Tracing | `[PLANNED]` | `observability/` |
| Agent Evaluation Suite | `[PLANNED]` | `evaluation/` |
| Architecture Simplification | `[PLANNED]` | Planned post-stability consolidation |