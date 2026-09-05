# Aegis — AI Engineering Operating System

> **Job**: *What AEGIS is*

**Aegis** is an **AI Engineering Operating System** that understands a software codebase, reasons about engineering tasks and changes, orchestrates specialized engineering agents, safely executes approved actions, and verifies the resulting work.

Aegis is NOT a simple chatbot, a generic coding assistant, or a RAG demo. It is an end-to-end software-engineering runtime built on TypeScript, Node.js, LangGraph, and Gemini model infrastructure.

---

## 🌟 Core Identity & Differentiators

AEGIS is built around five core capabilities:

1. **Repository Understanding & Digital Twin**: Constructs a persistent, revision-aware AST symbol graph, extracting API endpoints, database schemas, package dependencies, and line-level code relationships (`CALLS`, `IMPORTS`, `USES`).
2. **Dynamic Impact Analysis**: Calculates the exact blast radius of a proposed code change before modifying code (*"If I change UserService, what API routes and test suites break?"*).
3. **Specialized Multi-Agent System**: Deploys 7 specialized engineering agents (Planner, Researcher, Architect, Developer, Tester, Reviewer, Security) orchestrated by a state-driven LangGraph runtime.
4. **Safety & Policy Guardrails**: Low-level tool guardrails block dangerous actions (`rm -rf /`, path escapes) and trigger Human-in-the-Loop graph interruptions (`status: "paused"`) before executing sensitive mutations.
5. **Real GitHub Integration**: Production GitHub operations call live `api.github.com` REST APIs with credential masking. Zero fake or mock production data.

---

## 🔄 The AEGIS Engineering Lifecycle

```text
    UNDERSTAND → PLAN → RESEARCH → ARCHITECT → IMPLEMENT → TEST → REVIEW → SECURITY → APPROVAL → EXECUTE → VERIFY
```

AEGIS dynamically adapts its lifecycle based on task intent:
- **Non-Modifying / Investigation Queries** (*"Why is authentication failing?"*): Executes an investigation route (`UNDERSTAND → RESEARCH → REASON → ANSWER`).
- **Software Modification Tasks** (*"Fix authentication bug"*): Executes the full engineering lifecycle with safety guardrails and verification.

---

## 💻 Tech Stack

- **Language & Runtime**: TypeScript, Node.js (ESNext)
- **Model Infrastructure**: Google Gemini API (`@google/genai`, `gemini-2.5-flash`, `gemini-embedding-001`)
- **Orchestration Engine**: LangChain, LangGraph (`@langchain/langgraph`)
- **AST Parsing**: `ts-morph` (TypeScript Compiler API)
- **Backend Server**: Express.js, WebSockets (`ws`), CORS, Helmet
- **Database & Storage**: PostgreSQL, Prisma ORM, File-backed JSON Snapshot Store
- **Frontend Dashboard**: React, Next.js, Tailwind CSS

---

## 🚀 Usage Summary

### Interactive CLI (`cli.ts`)
```bash
# Connect & index codebase:
npx tsx cli.ts connect .

# Check repository status:
npx tsx cli.ts status repo_local_local_aegis

# Search codebase knowledge:
npx tsx cli.ts search repo_local_local_aegis "Where is project creation handled?"

# Run dynamic impact analysis:
npx tsx cli.ts impact repo_local_local_aegis PlannerAgent
```

### REST API Server
```bash
# Start API server at http://localhost:4000
npx tsx apps/api/server.ts
```

### Running Test Suite
```bash
# Master runner for all 25 test suites (Features 01–26):
npm run test
```

---

## 📖 Documentation Index

| Document | Responsibility |
| :--- | :--- |
| **`README.md`** | What AEGIS is |
| **[`Architecture.md`](file:///d:/Rakshith/Code%20Playback/Aegis/Architecture.md)** | How AEGIS is architected |
| **[`Directory-architecture.md`](file:///d:/Rakshith/Code%20Playback/Aegis/Directory-architecture.md)** | Where things live |
| **[`Agent_Flow.md`](file:///d:/Rakshith/Code%20Playback/Aegis/Agent_Flow.md)** | How agents/workflows interact |
| **[`AGENT_BUILD_CONTEXT.md`](file:///d:/Rakshith/Code%20Playback/Aegis/AGENT_BUILD_CONTEXT.md)** | Current implementation + feature history |
| **[`Build_plan.md`](file:///d:/Rakshith/Code%20Playback/Aegis/Build_plan.md)** | Original sequential build strategy |
| **[`Implementation_Plan.md`](file:///d:/Rakshith/Code%20Playback/Aegis/Implementation_Plan.md)** | Technical implementation details |
| **[`Must_build.md`](file:///d:/Rakshith/Code%20Playback/Aegis/Must_build.md)** | Non-negotiable product requirements |
| **[`Next_builds.md`](file:///d:/Rakshith/Code%20Playback/Aegis/Next_builds.md)** | Immediate upcoming work |
| **[`PR.md`](file:///d:/Rakshith/Code%20Playback/Aegis/PR.md)** | PR/verification procedure |