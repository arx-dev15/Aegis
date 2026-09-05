# Aegis Master Construction Build Plan

This document outlines the sequential construction roadmap for **Aegis**. Features 01 through 27 are fully implemented and verified.

---

## 🟢 PHASE 1 — FOUNDATION & MODEL LAYER `[IMPLEMENTED]`

- **Feature 01 — Gemini Model Layer**: Gemini SDK initialization (`@google/genai`), configuration, model binding (`models/gemini/model.ts`).
- **Feature 02 — Structured Output**: Zod schema to Gemini schema converter and response validation (`models/gemini/structured.ts`).
- **Feature 03 — Tool System**: Standardized tool interface, calculator, filesystem, and search schemas (`tools/`).
- **Feature 04 — First Tool-Calling Agent**: Single-agent tool execution loop with Gemini function declarations (`agents/agent.ts`).

---

## 🟢 PHASE 2 — LANGGRAPH ORCHESTRATION & STATE `[IMPLEMENTED]`

- **Feature 05 — LangGraph State**: Central `AegisStateAnnotation` definition (`graph/state.ts`).
- **Feature 06 — Nodes + Edges + Routing**: LangGraph node wrappers, conditional routing logic (`graph/nodes/`, `graph/edges/`).
- **Feature 07 — Single-Agent Graph**: Executing tool-calling agents inside LangGraph StateGraph (`graph/singleAgentWorkflow.ts`).
- **Feature 08 — Loops, Retries & Error Handling**: Bounded retry state, retry limits, error recovery nodes (`graph/resilientWorkflow.ts`).

---

## 🟢 PHASE 3 — SPECIALIZED AEGIS AGENTS `[IMPLEMENTED]`

- **Feature 09 — Planner Agent**: Task decomposition into structured `PlanStep[]` (`agents/planner/`).
- **Feature 10 — Researcher Agent**: Technical research, file discovery, context aggregation (`agents/researcher/`).
- **Feature 11 — Architect Agent**: System design, API spec creation, component boundaries (`agents/architect/`).
- **Feature 12 — Developer Agent**: Production code generation, file modification proposals (`agents/developer/`).
- **Feature 13 — Tester Agent**: Test suite construction & execution verification (`agents/tester/`).
- **Feature 14 — Reviewer Agent**: Quality assurance, code review, diff inspection (`agents/reviewer/`).
- **Feature 15 — Security Agent**: Vulnerability scanning, credential audit, injection prevention (`agents/security/`).

---

## 🟢 PHASE 4 — MULTI-AGENT ORCHESTRATION & ROUTING `[IMPLEMENTED]`

- **Feature 16 — Full Aegis Multi-Agent Workflow**: Wiring all 7 agents into an end-to-end StateGraph (`graph/multiAgentWorkflow.ts`).
- **Feature 17 — Agent Routing & Conditional Execution**: State-driven router (`determineNextAgent`) skipping redundant agent nodes when artifacts pre-exist (`graph/edges/agentRouter.ts`).
- **Feature 18 — Failure Recovery & Iteration Loops**: Contextual failure recovery via `recoveryNode` routing test/review failures back to Developer/Architect without full workflow restart (`graph/failureRecovery.test.ts`).

---

## 🟢 PHASE 5 — KNOWLEDGE & MEMORY SYSTEMS `[IMPLEMENTED]`

- **Feature 19 — RAG Pipeline**: File loading, sliding-window chunking, Gemini embeddings (`gemini-embedding-001`), cosine similarity vector store (`rag/`).
- **Feature 20 — Project Knowledge Retrieval**: `ProjectKnowledge` service for codebase knowledge ingestion and agent context enhancement (`rag/projectKnowledge.ts`).
- **Feature 21 — Short-Term Memory**: Run-isolated working scratchpad (`memory/short-term/shortTermMemory.ts`).
- **Feature 22 — Long-Term Memory**: Persistent epistemic knowledge store across process restarts (`memory/long-term/longTermMemory.ts`).

---

## 🟢 PHASE 6 — SAFETY, GUARDRAILS & REPOSITORY INTELLIGENCE `[IMPLEMENTED]`

- **Feature 23 — Human-in-the-Loop Approval**: Policy gate and `MemorySaver` graph interruption (`status: "paused"`) for sensitive actions (`graph/approvalWorkflow.ts`).
- **Feature 24 — Tool Permissions / Guardrails**: Direct low-level tool enforcement (`enforceToolGuardrail`) blocking dangerous system commands (`rm -rf /`) and path escapes (`tools/guardrails/`).
- **Feature 25 — Real GitHub Integration**: Production GitHub REST tools calling `api.github.com` live with `GITHUB_TOKEN` from `.env` and credential masking (`tools/github/`).
- **Feature 26 — Repository Intelligence Engine**: `ts-morph` AST parser, domain extractors (APIs, DB Models, Dependencies, Tests), typed provenance relationship graph, and hybrid impact analyzer (`repo-intelligence/`).
- **Feature 27 — Interactive CLI Foundation**: First-class command-line tool (`cli.ts`) for connecting, checking status, searching codebase knowledge, and running impact analysis directly.

---

## 🟡 PHASE 7 — ENVIRONMENT & EXTERNAL INTEGRATIONS `[IN PROGRESS / PLANNED]`

- **Build 28 — Terminal & Sandbox Execution** `[IN PROGRESS]`: Secure execution of `npm test`, `npm run build`, and `git diff` inside a sandboxed runner (`tools/terminal/`).
- **Build 29 — MCP Integration** `[PLANNED]`: Standardized Model Context Protocol server/client interface (`tools/mcp/`).
- **Build 30 — Session Runtime, Resume & Branching** `[PLANNED]`: Persistent session checkpoints allowing state reconstruction, branching, and rewinding (`graph/checkpointing/`).

---

## 🔵 PHASE 8 — QUALITY, OBSERVABILITY & EVALUATION `[PLANNED]`

- **Build 31 — Observability, Tracing & Token Tracking** `[PLANNED]`: Tracking agent runs, LLM calls, tool calls, token usage, latency, and costs (`observability/`).
- **Build 32 — Agent Evaluation & Benchmarks** `[PLANNED]`: Automated benchmark suite measuring planning accuracy, retrieval quality, and task success rate (`evaluation/`).

---

## 🟣 PHASE 9 — ARCHITECTURE SIMPLIFICATION & REFACTOR `[PLANNED]`

- **Build 33 — Architecture Simplification Refactor** `[PLANNED]`: Post-stability non-breaking consolidation to reduce file fragmentation, clean up barrel imports, and streamline internal structures while preserving 100% of capabilities, APIs, and tests.