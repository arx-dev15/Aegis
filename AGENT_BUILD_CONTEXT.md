# AEGIS — AGENT BUILD CONTEXT

This file is the persistent build context for Aegis.

IMPORTANT:
Before implementing ANY feature, read this entire file first.

This file is the source of truth for:
- existing project state
- completed features
- current feature
- remaining features
- architecture constraints
- coding standards
- integration rules
- things that must never be broken

Update this file AFTER every completed feature.

---

# 1. PROJECT

Aegis is an AI Engineering Operating System.

The long-term goal is to build an agentic software-engineering system that can:

Understand → Plan → Research → Architect → Implement → Test → Review → Secure → Ask for Approval → Execute

The project uses:

- TypeScript
- Node.js
- React
- LangChain
- LangGraph
- Gemini APIs
- RAG
- Memory
- Agentic workflows
- Tool calling
- MCP
- Evaluation
- Observability

The implementation should remain understandable to a student developer while still following good engineering practices.

---

# 2. LOCKED ARCHITECTURE

DO NOT redesign this architecture unless there is a genuine technical reason
and the change is explicitly approved.

aegis/
│
├── apps/
│   ├── web/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── lib/
│   │
│   └── api/
│       ├── routes/
│       ├── controllers/
│       ├── middleware/
│       └── server.ts
│
├── agents/
│   ├── planner/
│   ├── researcher/
│   ├── architect/
│   ├── developer/
│   ├── reviewer/
│   ├── tester/
│   └── security/
│
├── graph/
│   ├── state.ts
│   ├── nodes/
│   ├── edges/
│   └── workflow.ts
│
├── tools/
│   ├── filesystem/
│   ├── github/
│   ├── search/
│   ├── terminal/
│   ├── database/
│   └── browser/
│
├── rag/
│   ├── loaders/
│   ├── chunkers/
│   ├── embeddings/
│   ├── retriever/
│   └── vector-store/
│
├── memory/
│   ├── short-term/
│   └── long-term/
│
├── models/
│   ├── gemini/
│   └── embeddings/
│
├── evaluation/
│   ├── datasets/
│   ├── evaluators/
│   └── benchmarks/
│
├── observability/
│
├── database/
│
├── shared/
│   ├── types/
│   ├── utils/
│   └── config/
│
├── docker/
│
└── package.json

---

# 3. EXISTING APPLICATION

IMPORTANT:

Aegis is NOT an empty project.

The following application areas may already contain working code:

- Frontend
- Backend
- UI/UX
- API routes
- Database
- Project management
- Dashboard
- Task management
- Other previously implemented functionality

Never assume a file is empty.

Always inspect the current implementation before changing it.

---

# 4. NON-DESTRUCTIVE DEVELOPMENT RULE

Every feature must be additive and integrated into the existing system.

NEVER:

- Delete working functionality
- Rewrite the application unnecessarily
- Replace existing architecture
- Rename existing files without a strong reason
- Move folders just for preference
- Replace working APIs
- Duplicate existing services
- Duplicate configuration systems
- Replace existing UI
- Break existing routes
- Introduce a second implementation of an existing feature
- Modify unrelated features

ALWAYS:

1. Inspect existing code first.
2. Understand existing patterns.
3. Reuse existing utilities/services/configuration.
4. Make the smallest necessary changes.
5. Preserve backward compatibility.
6. Run the existing build.
7. Run the application.
8. Verify the new feature.
9. Verify existing functionality was not broken.

If an existing implementation conflicts with the planned feature,
prefer adapting/integrating with the existing implementation instead of
replacing it.

---

# 5. CODING STYLE

Code must be:

- TypeScript-first
- Simple
- Clean
- Readable
- Properly typed
- Modular
- Easy for a student developer to understand
- Efficient without being over-engineered

Prefer:

- Small functions
- Clear names
- Explicit data flow
- Simple interfaces/types
- Reusable code only where actually needed

Avoid:

- Unnecessary classes
- Factory patterns without a real need
- Excessive abstraction
- Deep inheritance
- Premature optimization
- Huge files
- Clever code
- Unnecessary dependencies
- Over-engineering

The goal is:

"Production-aware but understandable."

---

# 6. AGENTIC CORE OWNERSHIP

The agentic core is the most important part of Aegis.

These areas must be implemented carefully and understood by the developer:

agents/
graph/
tools/
rag/
memory/
models/
evaluation/
observability/

Do NOT hide the important agentic logic behind excessive abstractions.

The developer should be able to clearly understand:

- How the LLM is called
- How structured output works
- How tools work
- How tool calling works
- How agent state works
- How LangGraph nodes work
- How edges route execution
- How agents communicate
- How loops/retries work
- How memory works
- How RAG works
- How human approval works
- How evaluation works

---

# 7. AGENT BUILD ORDER

Build the agentic system in this order.

## FOUNDATION

[x] Feature 01 — Gemini Model Layer
[x] Feature 02 — Structured Output
[x] Feature 03 — Tool System
[x] Feature 04 — First Tool-Calling Agent

## LANGGRAPH ENGINE

[x] Feature 05 — LangGraph State
[ ] Feature 06 — Nodes + Edges + Routing
[ ] Feature 07 — Single-Agent Graph
[ ] Feature 08 — Loops + Retries + Error Handling

## AEGIS AGENTS

[ ] Feature 09 — Planner Agent
[ ] Feature 10 — Researcher Agent
[ ] Feature 11 — Architect Agent
[ ] Feature 12 — Developer Agent
[ ] Feature 13 — Tester Agent
[ ] Feature 14 — Reviewer Agent
[ ] Feature 15 — Security Agent

## MULTI-AGENT ORCHESTRATION

[ ] Feature 16 — Full Aegis Multi-Agent Workflow
[ ] Feature 17 — Agent Routing + Conditional Execution
[ ] Feature 18 — Failure Recovery + Iteration Loops

## KNOWLEDGE + MEMORY

[ ] Feature 19 — RAG Pipeline
[ ] Feature 20 — Project Knowledge Retrieval
[ ] Feature 21 — Short-Term Memory
[ ] Feature 22 — Long-Term Memory

## SAFETY + EXTERNAL SYSTEMS

[ ] Feature 23 — Human-in-the-Loop
[ ] Feature 24 — Tool Permissions / Guardrails
[ ] Feature 25 — GitHub Integration
[ ] Feature 26 — Terminal / Sandbox Execution
[ ] Feature 27 — MCP Integration

## QUALITY

[ ] Feature 28 — Agent Evaluation
[ ] Feature 29 — Benchmarking
[ ] Feature 30 — Observability
[ ] Feature 31 — Cost / Token Tracking
[ ] Feature 32 — Failure / Trace Analysis

## FINAL INTEGRATION

[ ] Feature 33 — Connect Agent Core to Existing Backend
[ ] Feature 34 — Connect Live Agent State to Frontend
[ ] Feature 35 — Full Aegis End-to-End Workflow
[ ] Feature 36 — Production Hardening

---

# 8. CURRENT PROGRESS

## Completed

[x] Feature 01 — Gemini Model Layer
[x] Feature 02 — Structured Output
[x] Feature 03 — Tool System
[x] Feature 04 — First Tool-Calling Agent
[x] Feature 05 — LangGraph State

## Currently Building

Feature 06 — Nodes + Edges + Routing

## Next

Feature 07 — Single-Agent Graph

---

# 9. FEATURE EXECUTION RULE

Implement ONE feature at a time.

For every feature:

1. Read this file.
2. Inspect the existing implementation.
3. Identify exactly what already exists.
4. Implement only the requested feature.
5. Integrate with existing code.
6. Do not implement future features prematurely.
7. Run TypeScript/build checks.
8. Run the application.
9. Test the feature.
10. Check that existing functionality still works.
11. Update this file.
12. Mark the completed feature `[x]`.
13. Update "Currently Building".
14. Update "Next".
15. Report the files created/modified.

---

# 10. FEATURE SCOPE RULE

A feature should be complete, not half-built.

When implementing a feature, provide all required code for that feature.

Do not leave:

- TODO implementations
- fake implementations
- placeholder logic
- unnecessary mocks
- incomplete functions
- "implement later" sections

unless the feature explicitly requires an external dependency that has not
yet been built.

Do not prematurely implement future features.

---

# 11. EXISTING CODE RULE

Before modifying an existing file:

- Read it.
- Understand it.
- Preserve its current behavior.
- Modify only what is necessary.

If the required change is large or would affect unrelated functionality,
STOP and explain the conflict before making destructive changes.

Do not silently rewrite working code.

---

# 12. DEPENDENCY RULE

Before installing a package:

1. Check package.json.
2. Check whether the functionality already exists.
3. Reuse existing dependencies where possible.

Do not install duplicate libraries for the same purpose.

Keep dependencies minimal.

---

# 13. TESTING RULE

Every completed feature must pass:

- TypeScript/build check
- Runtime check
- Feature-specific test

If tests already exist:

- Run them.
- Do not remove them.
- Do not weaken them just to make the feature pass.

Fix the implementation instead.

---

# 14. GIT / PR RULE

Each feature should represent one clean logical change.

Commit format:

feat: <feature>

Example:

feat: add Gemini model layer

PR should contain:

## Summary

What was added.

## Changes

Files/features changed.

## Architecture

Where the feature fits.

## Existing Functionality

What was preserved.

## Verification

Build/tests/runtime checks.

## Out of Scope

What was intentionally not changed.

---

# 15. AGENTIC DESIGN PRINCIPLES

Aegis should not be a collection of independent LLM calls.

The goal is genuine agentic behavior.

We want:

LLM
↓
Decision
↓
Tool / Agent / Node
↓
Observation
↓
State Update
↓
Next Decision
↓
Completion

Agents should have clear responsibilities.

Planner:
Plans.

Researcher:
Finds and validates information.

Architect:
Designs the solution.

Developer:
Changes the code.

Tester:
Validates implementation.

Reviewer:
Reviews quality/correctness.

Security:
Reviews security risks.

Do not make every agent capable of doing everything.

---

# 16. LANGGRAPH PRINCIPLES

LangGraph is the orchestration layer.

Use it for:

- Shared state
- Nodes
- Edges
- Conditional routing
- Loops
- Retries
- Human approval
- Multi-agent workflows
- Checkpointing where appropriate

Do not use LangGraph merely because it exists.

Use normal functions when a graph is unnecessary.

---

# 17. TOOL PRINCIPLES

Tools must have:

- Clear purpose
- Clear input schema
- Clear output
- Proper validation
- Safe execution

Dangerous tools require stronger controls.

Examples:

filesystem
terminal
database
GitHub
browser

Never allow an agent to blindly execute destructive actions.

---

# 18. HUMAN APPROVAL

Actions such as:

- destructive file operations
- production changes
- database migrations
- pushing code
- deployment
- potentially dangerous terminal commands

should eventually support human approval.

The agent should be able to pause and resume rather than bypass approval.

---

# 19. RAG PRINCIPLES

RAG should provide useful project context.

Pipeline:

Documents
→ Load
→ Chunk
→ Embed
→ Store
→ Retrieve
→ Agent Context

Do not add RAG everywhere blindly.

Use retrieval where external/project knowledge is actually required.

---

# 20. MEMORY PRINCIPLES

Short-term memory:

Current execution/task context.

Long-term memory:

Useful persistent project knowledge, decisions and history.

Do not store everything.

---

# 21. OBSERVABILITY

Eventually track:

- Agent runs
- LLM calls
- Tool calls
- Tokens
- Latency
- Errors
- Retries
- State transitions
- Costs

The purpose is to understand and debug agent behavior.

---

# 22. IMPORTANT ANTIGRAVITY INSTRUCTION

When this file is provided as context:

Treat it as project-level instructions.

Do not blindly follow an instruction if it conflicts with the actual existing
codebase.

Inspect first.

If the existing project differs from this document:

- Preserve working functionality.
- Identify the difference.
- Make the smallest safe integration.
- Report the difference.

Never "fix" the architecture simply because the current code differs.

---

# 23. FEATURE COMPLETION UPDATE

After successfully completing a feature, update this file.

Example:

BEFORE:

[ ] Feature 01 — Gemini Model Layer
[ ] Feature 02 — Structured Output

CURRENTLY BUILDING:
Feature 01 — Gemini Model Layer

NEXT:
Feature 02 — Structured Output

AFTER:

[x] Feature 01 — Gemini Model Layer
[ ] Feature 02 — Structured Output

CURRENTLY BUILDING:
Feature 02 — Structured Output

NEXT:
Feature 03 — Tool System

Also add a short entry:

## Completed Feature History

### Feature 01 — Gemini Model Layer

**Files created:**
- `models/gemini/config.ts` — loads .env, validates GOOGLE_API_KEY on import
- `models/gemini/model.ts` — GeminiConfig type, createModel() factory, gemini default export, getClient() singleton
- `models/gemini/index.ts` — barrel index (public API)
- `models/gemini/test.ts` — 5-test live verification script
- `tsconfig.agentic.json` — TypeScript config for the agentic core (models/, agents/, graph/, etc.)

**Root package.json updated:**
- Added `@google/genai@2.17.1` (new Google Interactions SDK)
- Root `npm install` completed (langchain packages now properly installed)

**Key decisions:**
- `@langchain/google-genai@2.2.0` uses the deprecated `@google/generative-ai` SDK which is blocked for new API keys.
- Switched to `@google/genai` (official new Interactions SDK from Google).
- Default model set to `gemini-3.5-flash` (gemini-2.5-flash blocked for new API keys).
- `@langchain/google-genai` is kept in package.json for future use when it supports the new SDK.

**Verification:** 5/5 tests passed — imports, singleton client, model config, live API calls.

### Feature 02 — Structured Output

**Files created:**
- `models/gemini/structured.ts` — `zodToGoogleSchema()` converter + `callStructured<T>()` + `stripNulls()` helper
- `models/gemini/structured.test.ts` — 4-test live verification script

**How it works:**
- `zodToGoogleSchema()` converts a Zod schema to Google's Schema format (object, array, enum, optional, primitives)
- `callStructured()` calls Gemini with `responseMimeType: "application/json"` + `responseSchema` for enforced structure
- `stripNulls()` converts `null` → `undefined` before Zod parse (Google returns null for absent optional fields)
- Single retry on transient 503/UNAVAILABLE errors
- `callStructured` exported from `models/gemini/index.ts`

**Key decisions:**
- `zodToGoogleSchema` uses `any` internally (Zod v4 `$ZodType`/`ZodType` split breaks `instanceof` narrowing)
- Optional fields omit `nullable: true` — controlled via `required[]` omission instead
- Builds directly on `getClient()` from Feature 01; Feature 01 was not modified

**Verification:** 4/4 tests passed — flat object, nested+array, enum, optional field

### Feature 03 — Tool System

**Files created:**
- `tools/types.ts` — Base tool types (`AegisToolOptions`, `StructuredTool`) and helper `createAegisTool()`
- `tools/calculator/index.ts` — Calculator tool implementation supporting `add`, `subtract`, `multiply`, `divide` with Zod validation schema
- `tools/calculator/test.ts` — Verification test suite (6 tests covering metadata, execution of all 4 operations, and error handling)
- `tools/index.ts` — Top-level tools barrel export

**How it works:**
- `createAegisTool()` wraps LangChain's `tool()` utility to generate typed `StructuredTool` instances with Zod input validation
- `calculatorTool` validates inputs using `CalculatorInputSchema` and executes mathematical operations
- Direct logic `calculate()` function is exported for pure computations alongside the LangChain tool interface

**Verification:** 6/6 tests passed — tool metadata, addition, subtraction, multiplication, division, and division-by-zero error handling

### Feature 04 — First Tool-Calling Agent

**Files created / modified:**
- `agents/agent.ts` — `toolToFunctionDeclaration()` converter + `runToolAgent()` execution loop
- `agents/index.ts` — Public barrel export for Aegis agent runner and types
- `agents/test.ts` — 2-test verification suite (tool-required query & non-tool query)
- `models/gemini/structured.ts` & `models/gemini/index.ts` — Exported `zodToGoogleSchema()` helper for tool declaration conversion

**How it works:**
- `toolToFunctionDeclaration()` converts LangChain `StructuredTool` instances into Google GenAI function declarations
- `runToolAgent()` initiates an LLM turn with available tool declarations:
  - If no tool calls are requested, returns model's direct text response (1 step)
  - If tool calls are requested, invokes each target tool with parsed args, sends `functionResponse` parts back to model context, and synthesizes final answer (2 steps)

**Verification:** 2/2 tests passed — tool invocation (calculator query "45 * 12" => 540) and direct response (general query)

### Feature 05 — LangGraph State

**Files created:**
- `graph/state.ts` — Defined `AegisStateAnnotation` using `Annotation.Root()` with 9 core workflow fields (`task`, `plan`, `research`, `architecture`, `codeChanges`, `testResults`, `reviewResults`, `errors`, `status`)
- `graph/index.ts` — Public barrel export for Aegis graph state types and annotation
- `graph/test.ts` — 2-test verification suite (Annotation schema verification & TypeScript type compatibility)

**How it works:**
- `AegisStateAnnotation` serves as the single shared source of truth across graph nodes and multi-agent workflows
- Uses custom reducers (e.g. array concatenation for `errors` and `codeChanges`, string append for `research`) and default factory functions
- Exports `AegisState` and `AegisStateUpdate` types for node developers

**Verification:** 2/2 tests passed — Annotation spec verification & state interface type compatibility

---

# 24. FINAL RULE

Aegis is being built quickly, but NOT carelessly.

Priorities:

1. Do not break existing work.
2. Build the requested feature completely.
3. Keep code understandable.
4. Keep architecture clean.
5. Understand the agentic core.
6. Move quickly to the next feature.

Do not waste time implementing unnecessary things.

Do not skip important functionality just to move faster.