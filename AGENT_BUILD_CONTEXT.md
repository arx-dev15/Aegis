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
- product direction
- coding standards
- integration rules
- lessons worth adopting from other agent runtimes
- things that must never be broken

Update this file AFTER every completed feature.

---

# 1. PROJECT

Aegis is an AI Engineering Operating System.

The goal is NOT to build another Claude Code clone or another generic chatbot.

Aegis should be a software-engineering runtime that can:

Understand → Plan → Research → Architect → Implement → Test → Review → Secure → Ask for Approval → Execute → Verify → Learn

Aegis combines:
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
- CLI/runtime integration

The implementation should remain understandable to a student developer while still following good engineering practices.

Core mental model:

CHATBOT:
Input → Output

AGENT:
Goal → Reason → Action → Observation → Reason → Action → Result

AEGIS:
Goal
 ↓
Project Understanding
 ↓
Planning
 ↓
Specialized Agents
 ↓
Tools / External Systems
 ↓
Observation + State
 ↓
Verification
 ↓
Reflection / Recovery
 ↓
Memory / Skills
 ↓
Result

---

# 2. PRODUCT DIRECTION — LOCKED

Aegis must be DIFFERENT from Coding Harness, Hermes, Athena, Claude Code, OpenHands, etc.

We may learn engineering concepts from them.

We MUST NOT copy their implementation, architecture, naming, or product identity.

Coding Harness is primarily an autonomous coding/execution harness.

Aegis is an AI Engineering Operating System.

Coding is one important capability inside Aegis, not the entire identity.

Aegis should eventually provide:

- Project intelligence
- Specialized engineering agents
- LangGraph orchestration
- Tool execution
- RAG/project knowledge
- Short-term and long-term memory
- Procedural skills
- Human approval
- Safe execution
- GitHub integration
- Terminal/sandbox execution
- MCP
- Evaluation
- Observability
- Web UI
- API
- First-class CLI
- Full end-to-end engineering workflows

Product principle:

"Build a runtime in which AI can perform software engineering responsibly."

---

# 3. LOCKED ARCHITECTURE

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

IMPORTANT:
The existing frontend/backend/UI/API architecture is already working.

Do not replace it simply to make the agentic architecture look cleaner.

---

# 4. EXISTING APPLICATION

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

# 5. NON-DESTRUCTIVE DEVELOPMENT RULE

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
adapt/integrate instead of replacing it.

---

# 6. CODING STYLE

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

Rule:

"Production-aware but understandable."

Move quickly, but do not skip important engineering.

---

# 7. AGENTIC CORE OWNERSHIP

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

Do NOT hide important agentic logic behind excessive abstractions.

The developer should clearly understand:
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
- How traces and observability work

---

# 8. WHAT AEGIS SHOULD LEARN FROM CODING HARNESS

We learn concepts, NOT implementation.

## 8.1 Context Engineering

Learn:
- Context is a limited resource.
- Tool results should not blindly accumulate forever.
- Stale file reads should be invalidated after mutations.
- Repeated/redundant context should be compacted.
- Large histories should eventually be summarized.
- Project instructions should be available as persistent context.

Aegis equivalent:
RAG + memory + context builder + state-aware context management.

Do NOT blindly copy a context-manager implementation.

---

## 8.2 Session Persistence

Learn:
- Agent runs should survive process restarts.
- Sessions need stable IDs.
- Execution history should be reconstructable.
- Checkpoints are useful.
- Branching/rewinding can be valuable later.

Aegis equivalent:
LangGraph state/checkpointing + database/session runtime.

Do NOT copy JSONL tree storage just because Coding Harness uses it.

---

## 8.3 Tool Registry

Learn:
- Tools need clear schemas.
- Tools need metadata.
- Read-only and mutating tools should be distinguishable.
- Tool execution should be observable.
- Tool permissions should be explicit.

Aegis already has the foundation for this.

---

## 8.4 Permission / Safety Engine

Learn:
LLM output should NOT directly control dangerous actions.

Concept:

LLM proposes
 ↓
Policy / Permission Layer
 ↓
Allow / Review / Deny
 ↓
Execute

Important for:
- file deletion
- terminal commands
- database mutations
- Git push
- deployment
- external side effects

This is a core Aegis principle.

---

## 8.5 Parallel Tool Execution

Learn:
Independent tool calls can sometimes execute concurrently.

Use parallel execution only when:
- operations are independent
- ordering does not matter
- safety rules allow it

Do not parallelize everything blindly.

---

## 8.6 User Steering

Learn:
A running agent should eventually be interruptible and steerable.

Example:

Agent running
 ↓
User interrupts
 ↓
Agent pauses safely
 ↓
User gives instruction
 ↓
Agent resumes with updated state

This belongs in the runtime/CLI stage.

---

## 8.7 Sub-Agent Isolation

Learn:
Sub-agents should have:
- clear task scope
- restricted tools
- limited context
- bounded depth
- explicit results

Avoid unlimited recursive delegation.

Aegis should use the task graph rather than uncontrolled recursion.

---

## 8.8 Headless Execution

Learn:
Agent systems should work without interactive UI.

Aegis should eventually support:
- CLI interactive mode
- headless task mode
- automation/CI usage

The same core runtime should power all interfaces.

---

## 8.9 Provider Abstraction

Learn:
Do not make the whole system depend on one provider.

Aegis currently uses Gemini as the primary model layer.

The architecture should still keep model access isolated enough that another provider can be introduced later without rewriting agents.

Do not implement multiple providers prematurely.

---

## 8.10 Observability

Learn:
An agent system must make its behavior inspectable.

Track eventually:
- agent runs
- graph transitions
- LLM calls
- tool calls
- latency
- tokens
- retries
- errors
- approvals
- costs
- final outcomes

Observability is not just logging.
It should explain WHY an agent run behaved the way it did.

---

# 9. ADDITIONAL AGENT-SYSTEM CONCEPTS TO ADOPT

These are important concepts seen across strong agent runtimes and should influence Aegis design.

## 9.1 Memory ≠ Skill

MEMORY:
"What happened / what is known."

SKILL:
"How to perform a repeatable task."

Aegis must keep this distinction.

Memory:
- project facts
- previous decisions
- execution history
- useful learned information

Skills:
- reusable procedures
- workflows
- engineering practices
- successful task recipes

Do not mix both into one giant vector database.

---

## 9.2 Procedural Skills

Eventually Aegis should support:

skills/
  testing.md
  react-feature.md
  api-debugging.md
  database-migration.md
  security-review.md

A skill describes:
- when it applies
- prerequisites
- procedure
- expected output
- failure modes

Skills should be reusable, not random prompt files.

---

## 9.3 Specialized Coding Environment

The Developer Agent should eventually have a controlled engineering environment:

Developer
 ↓
Inspect repository
 ↓
Plan changes
 ↓
Modify code
 ↓
Run tests
 ↓
Observe failures
 ↓
Repair
 ↓
Run tests again
 ↓
Review diff
 ↓
Approval
 ↓
Commit/merge

Do not treat "coding" as a single magical tool call.

---

## 9.4 Task Graph / Delegation

A complex mission should become a structured task graph.

Example:

MISSION
├── Research
│   ├── Inspect repository
│   ├── Search documentation
│   └── Identify constraints
│
├── Architecture
│   ├── Design solution
│   └── Identify risks
│
├── Implementation
│   ├── Backend
│   └── Frontend
│
└── Verification
    ├── Tests
    ├── Review
    └── Security

Each task should eventually have:
- owner
- status
- dependencies
- artifacts
- retries
- result
- confidence

LangGraph remains the orchestration layer.

---

## 9.5 Reflection / Verification

Aegis should not consider:

"LLM said it worked"

as verification.

Instead:

Action
 ↓
Observation
 ↓
Test / Evidence
 ↓
Evaluate
 ↓
Accept / Retry / Redirect

Verification should be evidence-based.

---

## 9.6 World / Project Model

Eventually Aegis should understand relationships between:

- projects
- repositories
- files
- modules
- APIs
- databases
- tasks
- agents
- decisions
- dependencies
- tests
- failures

This does NOT mean introducing a graph database immediately.

Start with simple structured state and project knowledge.

---

# 10. THINGS WE WILL NOT COPY FROM CODING HARNESS

Do NOT make Aegis:
- a Coding Harness clone
- a Claude Code clone
- a generic terminal wrapper
- a giant context-management framework
- a collection of unrelated tools
- an unlimited recursive agent system
- a giant "self-learning" system before the fundamentals work

Do NOT copy:
- its folder structure
- its session storage implementation
- its naming
- its CLI UX
- its provider implementation
- its permission implementation

We learn the underlying engineering ideas and build our own implementation around Aegis's architecture.

---

# 11. LANGGRAPH PRINCIPLES

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

The graph should represent meaningful execution logic.

---

# 12. TOOL PRINCIPLES

Tools must have:
- Clear purpose
- Clear input schema
- Clear output
- Proper validation
- Safe execution

Dangerous tools require stronger controls.

Examples:
- filesystem
- terminal
- database
- GitHub
- browser

Never allow an agent to blindly execute destructive actions.

---

# 13. HUMAN APPROVAL

Actions such as:
- destructive file operations
- production changes
- database migrations
- pushing code
- deployment
- potentially dangerous terminal commands

should support human approval.

The agent must be able to pause and resume.

Approval must happen outside the LLM's own decision logic.

---

# 14. RAG PRINCIPLES

RAG should provide useful project context.

Pipeline:

Documents
→ Load
→ Chunk
→ Embed
→ Store
→ Retrieve
→ Agent Context

Use retrieval where project/external knowledge is actually required.

Do not add RAG everywhere blindly.

---

# 15. MEMORY PRINCIPLES

Short-term memory:
Current execution/task context.

Long-term memory:
Useful persistent project knowledge, decisions and history.

Procedural memory / skills:
Reusable ways of performing tasks.

These are related but must remain conceptually separate.

Do not store everything.

---

# 16. EVALUATION PRINCIPLES

Aegis must eventually evaluate agents using evidence rather than subjective output alone.

Evaluate:
- task success
- tool correctness
- structured output validity
- routing correctness
- retry behavior
- final result quality
- regression rate
- cost
- latency
- safety violations

Do not build an elaborate evaluation platform before the core workflow works.

---

# 17. OBSERVABILITY

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
- Approvals
- Outcomes

The purpose is to understand and debug agent behavior.

---

# 18. CLI / RUNTIME PRINCIPLES

Aegis should eventually have a first-class CLI.

The CLI is NOT a separate agent implementation.

Architecture:

CLI
 │
Web
 │
API
 ↓
Aegis Core Runtime
 ↓
LangGraph / Agents / Tools

All interfaces must use the same core.

The CLI should eventually support:
- interactive sessions
- task execution
- session resume
- agent progress
- tool activity
- approval prompts
- headless mode
- CI/automation usage

Bun may be used where it genuinely improves the CLI/runtime experience, but do not introduce Bun unnecessarily into the existing application.

---

# 19. AGENT BUILD ORDER

Build ONE feature at a time.

## FOUNDATION

[x] Feature 01 — Gemini Model Layer
[x] Feature 02 — Structured Output
[x] Feature 03 — Tool System
[x] Feature 04 — First Tool-Calling Agent

## LANGGRAPH ENGINE

[x] Feature 05 — LangGraph State
[x] Feature 06 — Nodes + Edges + Routing
[x] Feature 07 — Single-Agent Graph
[x] Feature 08 — Loops + Retries + Error Handling

## AEGIS AGENTS

[x] Feature 09 — Planner Agent
[x] Feature 10 — Researcher Agent
[x] Feature 11 — Architect Agent
[x] Feature 12 — Developer Agent
[x] Feature 13 — Tester Agent
[x] Feature 14 — Reviewer Agent
[x] Feature 15 — Security Agent

## MULTI-AGENT ORCHESTRATION

[x] Feature 16 — Full Aegis Multi-Agent Workflow
[ ] Feature 17 — Agent Routing + Conditional Execution
[ ] Feature 18 — Failure Recovery + Iteration Loops
[ ] Feature 19 — Task Dependencies + Delegation

## KNOWLEDGE + MEMORY

[ ] Feature 20 — RAG Pipeline
[ ] Feature 21 — Project Knowledge Retrieval
[ ] Feature 22 — Short-Term Memory
[ ] Feature 23 — Long-Term Memory
[ ] Feature 24 — Procedural Skills

## SAFETY + EXTERNAL SYSTEMS

[ ] Feature 25 — Human-in-the-Loop
[ ] Feature 26 — Tool Permissions / Guardrails
[ ] Feature 27 — GitHub Integration
[ ] Feature 28 — Terminal / Sandbox Execution
[ ] Feature 29 — Browser Integration
[ ] Feature 30 — MCP Integration

## QUALITY

[ ] Feature 31 — Agent Evaluation
[ ] Feature 32 — Benchmarking
[ ] Feature 33 — Observability
[ ] Feature 34 — Cost / Token Tracking
[ ] Feature 35 — Failure / Trace Analysis

## RUNTIME + INTEGRATION

[ ] Feature 36 — Aegis CLI Foundation
[ ] Feature 37 — Session Runtime / Resume
[ ] Feature 38 — Headless / Automation Mode
[ ] Feature 39 — Connect Agent Core to Existing Backend
[ ] Feature 40 — Connect Live Agent State to Frontend
[ ] Feature 41 — Full Aegis End-to-End Workflow
[ ] Feature 42 — Production Hardening

IMPORTANT:
The exact implementation order may change only when a genuine dependency requires it.
Do not add random features simply because they are interesting.

---

# 20. CURRENT PROGRESS

## Completed

[x] Feature 01 — Gemini Model Layer
[x] Feature 02 — Structured Output
[x] Feature 03 — Tool System
[x] Feature 04 — First Tool-Calling Agent
[x] Feature 05 — LangGraph State
[x] Feature 06 — Nodes + Edges + Routing
[x] Feature 07 — Single-Agent Graph
[x] Feature 08 — Loops + Retries + Error Handling
[x] Feature 09 — Planner Agent
[x] Feature 10 — Researcher Agent
[x] Feature 11 — Architect Agent
[x] Feature 12 — Developer Agent
[x] Feature 13 — Tester Agent
[x] Feature 14 — Reviewer Agent
[x] Feature 15 — Security Agent
[x] Feature 16 — Full Aegis Multi-Agent Workflow

## Currently Building

Feature 17 — Agent Routing + Conditional Execution

## Next

Feature 18 — Failure Recovery + Iteration Loops

---

# 21. FEATURE EXECUTION RULE

Implement ONE feature at a time.

For every feature:

1. Read this file.
2. Inspect existing implementation.
3. Identify exactly what already exists.
4. Implement only the requested feature.
5. Integrate with existing code.
6. Do not implement future features prematurely.
7. Run TypeScript/build checks.
8. Run the application.
9. Test the feature.
10. Check existing functionality still works.
11. Update this file.
12. Mark the completed feature [x].
13. Update Currently Building.
14. Update Next.
15. Report files created/modified.

---

# 22. FEATURE SCOPE RULE

A feature should be complete, not half-built.

Do not leave:
- TODO implementations
- fake implementations
- placeholder logic
- unnecessary mocks
- incomplete functions
- "implement later" sections

unless the feature explicitly depends on a future external component.

Do not prematurely implement future features.

---

# 23. EXISTING CODE RULE

Before modifying an existing file:
- Read it.
- Understand it.
- Preserve current behavior.
- Modify only what is necessary.

If the required change is large or affects unrelated functionality,
STOP and explain the conflict before making destructive changes.

Do not silently rewrite working code.

---

# 24. DEPENDENCY RULE

Before installing a package:
1. Check package.json.
2. Check whether functionality already exists.
3. Reuse existing dependencies where possible.

Do not install duplicate libraries.

Keep dependencies minimal.

---

# 25. TESTING RULE

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

# 26. GIT / PR RULE

Each feature represents one clean logical change.

Commit format:

feat: <feature>

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

# 27. AGENTIC DESIGN PRINCIPLES

Aegis should not be a collection of independent LLM calls.

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

# 28. RELIABILITY PRINCIPLES

The LLM must not control the entire system.

Use deterministic infrastructure underneath it.

LLM proposes action
 ↓
Validation / Policy
 ↓
Allow / Review / Deny
 ↓
Execute
 ↓
Observe
 ↓
Verify

Bound all agent execution.

Every important loop should have:
- retry limits
- step limits
- error handling
- clear terminal states

No infinite autonomous loops.

---

# 29. PROJECT INTELLIGENCE

Aegis should eventually understand:

Repository
├── architecture
├── dependencies
├── APIs
├── database
├── components
├── tests
├── documentation
├── git history
└── engineering decisions

Do not dump the whole repository into the model.

Use:
- targeted inspection
- retrieval
- structured project metadata
- memory
- relevant tool results

---

# 30. FEATURE COMPLETION UPDATE

After successfully completing a feature, update this file.

Example:

BEFORE:

[x] Feature 08
[ ] Feature 09

CURRENTLY BUILDING:
Feature 09

NEXT:
Feature 10

AFTER:

[x] Feature 08
[x] Feature 09

CURRENTLY BUILDING:
Feature 10

NEXT:
Feature 11

Also add a short entry:

## Completed Feature History

### Feature 01 — Gemini Model Layer

Files created:
- models/gemini/config.ts
- models/gemini/model.ts
- models/gemini/index.ts
- models/gemini/test.ts
- tsconfig.agentic.json

Key decisions:
- @google/genai is the current Gemini SDK.
- Default model is gemini-3.5-flash based on the working API configuration.
- Gemini access is isolated in the model layer.

Verification:
5/5 tests passed.

### Feature 02 — Structured Output

Files created:
- models/gemini/structured.ts
- models/gemini/structured.test.ts

Key decisions:
- Zod schemas are converted into Gemini-compatible schemas.
- Structured output is validated before being returned to agents.

Verification:
4/4 tests passed.

### Feature 03 — Tool System

Files created:
- tools/types.ts
- tools/calculator/index.ts
- tools/calculator/test.ts
- tools/index.ts

Key decisions:
- Tools have explicit schemas and metadata.
- LangChain tool interfaces are used without hiding execution logic.

Verification:
6/6 tests passed.

### Feature 04 — First Tool-Calling Agent

Files created/modified:
- agents/agent.ts
- agents/index.ts
- agents/test.ts
- models/gemini/structured.ts
- models/gemini/index.ts

Key decisions:
- Gemini function declarations are generated from tool schemas.
- Agent executes tool calls and feeds observations back to the model.

Verification:
2/2 tests passed.

### Feature 05 — LangGraph State

Files created:
- graph/state.ts
- graph/index.ts
- graph/test.ts

Key decisions:
- Shared Aegis state is the source of truth for graph execution.

Verification:
2/2 tests passed.

### Feature 06 — LangGraph Nodes + Edges + Routing

Files created/modified:
- graph/nodes/sampleNodes.ts
- graph/edges/routing.ts
- graph/workflow.ts
- graph/index.ts
- graph/workflow.test.ts

Key decisions:
- Nodes perform work.
- Conditional edges determine execution paths.

Verification:
2/2 tests passed.

### Feature 07 — Single-Agent Graph

Files created/modified:
- graph/nodes/agentNode.ts
- graph/singleAgentWorkflow.ts
- graph/index.ts
- graph/singleAgentWorkflow.test.ts

Key decisions:
- The tool-calling agent is executed as a LangGraph node.

Verification:
2/2 tests passed.

### Feature 08 — Loops, Retries & Error Handling

Files created/modified:
- graph/state.ts
- graph/nodes/resilientNodes.ts
- graph/edges/retryRouting.ts
- graph/resilientWorkflow.ts
- graph/index.ts
- graph/resilientWorkflow.test.ts

Key decisions:
- Retry state is explicit.
- Retry routing is deterministic.
- Maximum retries terminate safely.

Verification:
3/3 tests passed.

### Feature 09 — Planner Agent

Files created/modified:
- agents/planner/schema.ts
- agents/planner/planner.ts
- agents/planner/index.ts
- agents/planner/test.ts
- agents/index.ts
- graph/nodes/plannerNode.ts
- graph/plannerWorkflow.ts
- graph/plannerWorkflow.test.ts
- graph/index.ts
- AGENT_BUILD_CONTEXT.md

Key decisions:
- Unified schema and types in `types.ts` as single-source-of-truth using `z.infer`, re-exported in `schema.ts` for clean resolution.
- Created `GeminiPlannerModel` bridging `PlannerAgent` with `callStructured` from Gemini model layer (`models/gemini/index.ts`).
- Configured `PlannerAgent` to default to `GeminiPlannerModel` while preserving mock model dependency injection for tests.
- Integrated `PlannerAgent` into LangGraph via `plannerNode` in `graph/nodes/plannerNode.ts`, mapping `PlannerResult` to `PlanStep[]` and updating `AegisState`.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit`): Passed with 0 errors.
- Unit tests (`npx tsx agents/planner/test.ts`): Passed.
- Workflow tests (`npx tsx graph/plannerWorkflow.test.ts`): 2/2 passed.
- Feature 01–08 regression tests: All passed.

### Feature 10 — Researcher Agent

Files created/modified:
- agents/researcher/types.ts
- agents/researcher/schema.ts
- agents/researcher/prompt.ts
- agents/researcher/researcher.ts
- agents/researcher/index.ts
- agents/researcher/test.ts
- agents/index.ts
- graph/nodes/researcherNode.ts
- graph/researcherWorkflow.ts
- graph/researcherWorkflow.test.ts
- graph/index.ts
- AGENT_BUILD_CONTEXT.md

Key decisions:
- Unified schema and types in `types.ts` defining `researchFindingSchema` and `researchResultSchema`, re-exported in `schema.ts`.
- Created `GeminiResearcherModel` bridging `ResearcherAgent` with `callStructured` from Gemini model layer (`models/gemini/index.ts`).
- Created `researcherNode` in `graph/nodes/researcherNode.ts` mapping `ResearchResult` into `AegisState` with status `"researching"`.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit`): Passed with 0 errors.
- Unit tests (`npx tsx agents/researcher/test.ts`): Passed.
- Workflow tests (`npx tsx graph/researcherWorkflow.test.ts`): 2/2 passed.
- Feature 01–09 regression tests: All passed.

### Feature 11 — Architect Agent

Files created/modified:
- agents/architect/types.ts
- agents/architect/schema.ts
- agents/architect/prompt.ts
- agents/architect/architect.ts
- agents/architect/index.ts
- agents/architect/test.ts
- agents/index.ts
- graph/nodes/architectNode.ts
- graph/architectWorkflow.ts
- graph/architectWorkflow.test.ts
- graph/index.ts
- AGENT_BUILD_CONTEXT.md

Key decisions:
- Unified schema and types in `types.ts` defining `componentDesignSchema` and `architectureResultSchema`, re-exported in `schema.ts`.
- Created `GeminiArchitectModel` bridging `ArchitectAgent` with `callStructured` from Gemini model layer (`models/gemini/index.ts`).
- Created `architectNode` in `graph/nodes/architectNode.ts` mapping `ArchitectureResult` into `AegisState` with status `"architecting"`.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit`): Passed with 0 errors.
- Unit tests (`npx tsx agents/architect/test.ts`): Passed.
- Workflow tests (`npx tsx graph/architectWorkflow.test.ts`): 2/2 passed.
- Feature 01–10 regression tests: All passed.

### Feature 12 — Developer Agent

Files created/modified:
- agents/developer/types.ts
- agents/developer/schema.ts
- agents/developer/prompt.ts
- agents/developer/developer.ts
- agents/developer/index.ts
- agents/developer/test.ts
- agents/index.ts
- graph/nodes/developerNode.ts
- graph/developerWorkflow.ts
- graph/developerWorkflow.test.ts
- graph/index.ts
- AGENT_BUILD_CONTEXT.md

Key decisions:
- Unified schema and types in `types.ts` defining `fileChangeSchema` and `developerResultSchema`, re-exported in `schema.ts`.
- Created `GeminiDeveloperModel` bridging `DeveloperAgent` with `callStructured` from Gemini model layer (`models/gemini/index.ts`).
- Created `developerNode` in `graph/nodes/developerNode.ts` mapping `DeveloperResult.fileChanges` to `CodeChange[]` on `AegisState` with status `"developing"`.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit`): Passed with 0 errors.
- Unit tests (`npx tsx agents/developer/test.ts`): Passed.
- Workflow tests (`npx tsx graph/developerWorkflow.test.ts`): 2/2 passed.
- Feature 01–11 regression tests: All passed.

### Feature 13 — Tester Agent

Files created/modified:
- agents/tester/types.ts
- agents/tester/schema.ts
- agents/tester/prompt.ts
- agents/tester/tester.ts
- agents/tester/index.ts
- agents/tester/test.ts
- agents/index.ts
- graph/nodes/testerNode.ts
- graph/testerWorkflow.ts
- graph/testerWorkflow.test.ts
- graph/index.ts
- AGENT_BUILD_CONTEXT.md

Key decisions:
- Unified schema and types in `types.ts` defining `singleTestRunSchema` and `testerResultSchema`, re-exported in `schema.ts`.
- Created `GeminiTesterModel` bridging `TesterAgent` with `callStructured` from Gemini model layer (`models/gemini/index.ts`).
- Created `testerNode` in `graph/nodes/testerNode.ts` mapping `TesterResult` to `TestResult` on `AegisState.testResults` with status `"testing"`.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit`): Passed with 0 errors.
- Unit tests (`npx tsx agents/tester/test.ts`): Passed.
- Workflow tests (`npx tsx graph/testerWorkflow.test.ts`): 2/2 passed.
- Feature 01–12 regression tests: All passed.

### Feature 14 — Reviewer Agent

Files created/modified:
- agents/reviewer/types.ts
- agents/reviewer/schema.ts
- agents/reviewer/prompt.ts
- agents/reviewer/reviewer.ts
- agents/reviewer/index.ts
- agents/reviewer/test.ts
- agents/index.ts
- graph/nodes/reviewerNode.ts
- graph/reviewerWorkflow.ts
- graph/reviewerWorkflow.test.ts
- graph/index.ts
- AGENT_BUILD_CONTEXT.md

Key decisions:
- Unified schema and types in `types.ts` defining `reviewFindingSchema` and `reviewerResultSchema`, re-exported in `schema.ts`.
- Created `GeminiReviewerModel` bridging `ReviewerAgent` with `callStructured` from Gemini model layer (`models/gemini/index.ts`).
- Created `reviewerNode` in `graph/nodes/reviewerNode.ts` mapping `ReviewerResult` to `ReviewResult` on `AegisState.reviewResults` with status `"reviewing"`.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit`): Passed with 0 errors.
- Unit tests (`npx tsx agents/reviewer/test.ts`): Passed.
- Workflow tests (`npx tsx graph/reviewerWorkflow.test.ts`): 2/2 passed.
- Feature 01–13 regression tests: All passed.

### Feature 15 — Security Agent

Files created/modified:
- agents/security/types.ts
- agents/security/schema.ts
- agents/security/prompt.ts
- agents/security/security.ts
- agents/security/index.ts
- agents/security/test.ts
- agents/index.ts
- graph/nodes/securityNode.ts
- graph/securityWorkflow.ts
- graph/securityWorkflow.test.ts
- graph/index.ts
- AGENT_BUILD_CONTEXT.md

Key decisions:
- Unified schema and types in `types.ts` defining `securityVulnerabilitySchema` and `securityResultSchema`, re-exported in `schema.ts`.
- Created `GeminiSecurityModel` bridging `SecurityAgent` with `callStructured` from Gemini model layer (`models/gemini/index.ts`).
- Created `securityNode` in `graph/nodes/securityNode.ts` auditing security risks and updating `AegisState`.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit`): Passed with 0 errors.
- Unit tests (`npx tsx agents/security/test.ts`): Passed.
- Workflow tests (`npx tsx graph/securityWorkflow.test.ts`): 2/2 passed.
- Feature 01–14 regression tests: All passed.

### Feature 16 — Full Aegis Multi-Agent Workflow

Files created/modified:
- graph/nodes/multiAgentNodes.ts
- graph/edges/multiAgentRouting.ts
- graph/multiAgentWorkflow.ts
- graph/multiAgentWorkflow.test.ts
- graph/index.ts
- tsconfig.json
- AGENT_BUILD_CONTEXT.md

Key decisions:
- Connected all 7 specialized engineering agents (Planner, Researcher, Architect, Developer, Tester, Reviewer, Security) into a single LangGraph StateGraph orchestration workflow.
- Created `retryLoopNode` to increment `retryCount` and record repair context before returning execution to `developer`.
- Created conditional routing functions (`routeAfterPlanner`, `routeAfterResearcher`, `routeAfterArchitect`, `routeAfterDeveloper`, `routeAfterTester`, `routeAfterReviewer`, `routeAfterSecurity`) enabling feedback loop recovery when Tester, Reviewer, or Security finds issues, while respecting `maxRetries` limits.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit` & `npx tsc --noEmit`): Passed with 0 errors.
- Multi-agent workflow tests (`npx tsx graph/multiAgentWorkflow.test.ts`): 3/3 passed (End-to-end execution, conditional feedback loop repair, max retries terminal failure).
- Feature 01–15 regression tests: All passed.

---

# 31. LOCKED AEGIS DIFFERENTIATORS

Aegis should eventually stand out through:

1. Specialized engineering agents rather than one general coding agent.
2. LangGraph-based orchestration and explicit state.
3. Project intelligence rather than raw file dumping.
4. Evidence-based verification.
5. Human approval for consequential actions.
6. Memory + procedural skills as separate concepts.
7. Task dependency graph and controlled delegation.
8. Strong observability of agent behavior.
9. Same core runtime exposed through Web, API and CLI.
10. Safe recovery and iteration instead of blind autonomy.

These are product-level goals, not excuses to over-engineer the current feature.

---

# 32. FINAL RULE

Aegis is being built quickly, but NOT carelessly.

Priorities:

1. Do not break existing work.
2. Build the requested feature completely.
3. Keep code understandable.
4. Keep architecture clean.
5. Understand the agentic core.
6. Use proven agent-system concepts where they add real value.
7. Keep Aegis distinct from Coding Harness and other runtimes.
8. Move quickly to the next feature.
9. Do not over-engineer.
10. Do not skip important functionality just to move faster.

When in doubt:

BUILD THE SIMPLEST CORRECT VERSION THAT PRESERVES THE ARCHITECTURE.

Do not build a feature merely because another agent framework has it.

Build it when it makes Aegis better.
