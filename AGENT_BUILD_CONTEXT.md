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
[x] Feature 17 — Agent Routing + Conditional Execution
[x] Feature 18 — Failure Recovery + Iteration Loops
[ ] Feature 19 — Task Dependencies + Delegation

## KNOWLEDGE + MEMORY

[x] Feature 19 — RAG Pipeline
[x] Feature 20 — Project Knowledge Retrieval
[x] Feature 21 — Short-Term Memory
[x] Feature 22 — Long-Term Memory
[ ] Feature 23 — Procedural Skills

## SAFETY + EXTERNAL SYSTEMS

[x] Feature 23 — Human-in-the-Loop
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
[x] Feature 17 — Agent Routing + Conditional Execution
[x] Feature 18 — Failure Recovery + Iteration Loops
[x] Feature 19 — RAG Pipeline
[x] Feature 20 — Project Knowledge Retrieval
[x] Feature 21 — Short-Term Memory
[x] Feature 22 — Long-Term Memory
[x] Feature 23 — Human-in-the-Loop
[x] Feature 24 — Tool Permissions / Guardrails
[x] Feature 25 — GitHub Integration

## Currently Building

Feature 26 — Terminal / Sandbox Execution

## Next

Feature 27 — MCP Integration


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
### Feature 17 — Agent Routing + Conditional Execution

Files created/modified:
- graph/edges/agentRouter.ts
- graph/edges/agentRouter.test.ts
- graph/dynamicRoutingWorkflow.ts
- graph/dynamicRoutingWorkflow.test.ts
- graph/index.ts
- testAll.ts
- AGENT_BUILD_CONTEXT.md

Key decisions:
- Created deterministic state routing function `determineNextAgent(state: AegisState)` that evaluates state status, validation failure state, and pre-existing artifacts.
- Supports conditional execution and artifact skipping: if state is pre-populated with artifacts (e.g. plan/architecture), prior agent nodes are skipped and execution starts dynamically at the next required agent node.
- Created `buildDynamicRoutingWorkflow()` compiling dynamic conditional edges from START and after every agent node.
- Preserved 100% backward compatibility with all 16 existing features and existing test suites.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit` & `npx tsc --noEmit`): Passed with 0 errors.
- Unit tests (`npx tsx graph/edges/agentRouter.test.ts`): 12/12 passed.
- Dynamic workflow tests (`npx tsx graph/dynamicRoutingWorkflow.test.ts`): 3/3 passed.
- Master test runner (`npm run test`): 17/17 test suites passed (0 failures).

### Feature 18 — Failure Recovery + Iteration Loops

Files created/modified:
- `graph/state.ts` (added `RecoveryContext` interface with expanded `failingAgent` union + `recoveryContext` annotation field)
- `graph/nodes/recoveryNode.ts` [NEW] (smart recovery node building structured failure context across all agents)
- `agents/developer/developer.ts` (added optional `recoveryContext` param to `develop()`)
- `graph/nodes/developerNode.ts` (extract & format latest `RecoveryContext` to pass to developer agent)
- `graph/edges/agentRouter.ts` (added `routeFromRecovery` conditional routing helper, routed failures to "recovery")
- `graph/edges/agentRouter.test.ts` (updated Test 11 assertion to expect "recovery")
- `graph/dynamicRoutingWorkflow.ts` (wired `recoveryNode` with `addConditionalEdges("recovery", routeFromRecovery)`)
- `graph/multiAgentWorkflow.ts` (added `recovery?: typeof retryLoopNode` to `CustomMultiAgentNodes`)
- `graph/index.ts` (exported `recoveryNode`)
- `graph/failureRecovery.test.ts` [NEW] (7 comprehensive recovery and iteration loop tests)
- `testAll.ts` (registered `graph/failureRecovery.test.ts`)
- `AGENT_BUILD_CONTEXT.md`

Recovery Strategy:
- **Failure Detection**: Captures testing failures (`testResults.passed === false`), reviewer rejections (`reviewResults.approved === false`), security vulnerabilities, and agent errors across planning, research, architecture, and development.
- **Recovery Routing**: Uses `routeFromRecovery` conditional edge based on `failingAgent`:
  - Research failure -> Researcher iteration
  - Architecture failure/rejection -> Architect iteration
  - Implementation / Test / Review / Security failure -> Developer repair iteration
- **Iteration Limits**: `retryCount` incremented by `recoveryNode`. Evaluated against `maxRetries` (default 3) in `determineNextAgent`. Exceeding `maxRetries` routes to `multiAgentErrorHandlerNode` for clean terminal failure (`status: "failed"`) while preserving full `recoveryContext` and error history in state.
- **State Preservation**: Reused `AegisStateAnnotation` without duplicating state management. Appended structured `RecoveryContext` containing `failingAgent`, `reason`, `details`, and `attemptNumber`.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit` & `npx tsc --noEmit`): Passed with 0 errors.
- Feature 18 tests (`npx tsx graph/failureRecovery.test.ts`): 7/7 passed.
- Master test runner (`npm run test`): 18/18 test suites passed (0 failures).

---

### Feature 19 — RAG Pipeline

Files created:
- `rag/types.ts` [NEW] — Core shared types: `Document`, `Chunk`, `EmbeddedChunk`, `RetrievalResult`
- `rag/loaders/fileLoader.ts` [NEW] — Filesystem document loader: `loadFile`, `loadFiles`, `loadDirectory`
- `rag/chunkers/textChunker.ts` [NEW] — Deterministic sliding-window text chunker: `chunkDocument`, `chunkDocuments`
- `rag/embeddings/geminiEmbedder.ts` [NEW] — Gemini embedding adapter: `GeminiEmbedder`, `EmbedderInterface`
- `rag/vector-store/inMemoryStore.ts` [NEW] — In-memory cosine similarity vector store: `InMemoryVectorStore`, `VectorStoreInterface`
- `rag/retriever/retriever.ts` [NEW] — Query-to-embedding-to-search retriever: `Retriever`
- `rag/pipeline.ts` [NEW] — Public pipeline API: `RagPipeline`, `createRagPipeline`
- `rag/index.ts` [NEW] — Barrel export for entire rag/ module
- `rag/rag.test.ts` [NEW] — 9-test suite covering all pipeline stages
- `testAll.ts` [MODIFIED] — Added `rag/rag.test.ts` to master runner
- `AGENT_BUILD_CONTEXT.md` [MODIFIED]

Data Flow:
```
Documents                            (files, text)
 → loadFile / loadDirectory          (rag/loaders/fileLoader.ts)
 → chunkDocument / chunkDocuments    (rag/chunkers/textChunker.ts)
 → GeminiEmbedder.embedBatch         (rag/embeddings/geminiEmbedder.ts)
 → InMemoryVectorStore.add           (rag/vector-store/inMemoryStore.ts)

Query
 → GeminiEmbedder.embed              (rag/embeddings/geminiEmbedder.ts)
 → InMemoryVectorStore.search        (cosine similarity)
 → Retriever.retrieveContext         (rag/retriever/retriever.ts)
 → Agent Prompt Context              (ready for Feature 20)
```

Key decisions:
- Reused existing `getClient()` from `models/gemini/model.ts` for embedding. No new dependency added.
- Embedding model: `gemini-embedding-001` (confirmed available for this API key; produces 3072-dim vectors).
- Interface-based design (`EmbedderInterface`, `VectorStoreInterface`) allows backend swap without touching pipeline or retriever.
- All RAG pipeline components are injectable — tests run entirely without live API calls using mock embedder.
- In-memory vector store uses linear cosine similarity scan. Simple, correct, and maintainable for Feature 19. Persistent store deferred to when genuinely needed.
- Chunking is deterministic (character-based sliding window, optional sentence-boundary split). No LLM calls in chunker.
- No agents were modified. RAG is standalone infrastructure; Feature 20 will connect it to agents.
- No new npm packages installed — `@google/genai` already had `embedContent` capability.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit`): Passed with 0 errors.
- TypeScript compilation (`npx tsc --noEmit`): Passed with 0 errors.
- Feature 19 tests (`npx tsx rag/rag.test.ts`): 9/9 passed (including live Gemini embedding test).
- Master test runner (`npm run test`): 19/19 test suites passed (0 failures).

---

### Feature 20 — Project Knowledge Retrieval

Files created/modified:
- `rag/projectKnowledge.ts` [NEW] — `ProjectKnowledge` service providing `ingestProject`, `ingestFiles`, `ingestDocument`, `queryKnowledge`, `getFormattedContext`, and `enhanceContext`.
- `rag/index.ts` [MODIFIED] — Re-exported `ProjectKnowledge`, `createProjectKnowledge`, `ProjectKnowledgeOptions`, and `QueryKnowledgeOptions`.
- `rag/projectKnowledge.test.ts` [NEW] — 5-test suite covering project knowledge ingestion, metadata preservation, empty/irrelevant query safety, top-K limits, context formatting/enhancement, and agent integration.
- `testAll.ts` [MODIFIED] — Added `rag/projectKnowledge.test.ts` to master runner
- `AGENT_BUILD_CONTEXT.md` [MODIFIED] — Updated Feature 20 progress.

Data Flow:
```
Project Files / Codebase
 → ProjectKnowledge.ingestProject(...) / ingestFiles(...)
 → RagPipeline (Feature 19)
 → Chunks + Vector Store Embeddings

Agent Query / Request
 → ProjectKnowledge.getFormattedContext(query, topK)
 → Formatted Markdown Context Block with Source Metadata & Scores
 → Agent Prompt (e.g. ResearcherAgent / PlannerAgent)
```

Key Decisions:
- Reused Feature 19 `RagPipeline` directly. No second RAG pipeline, extra database, or duplicate vector store was created.
- Project Knowledge Retrieval is exposed as an explicit service (`ProjectKnowledge`) that agents or nodes can call on demand. Retrieval is NOT automatically injected into every agent call.
- Context formatting preserves clear source headers (`[PROJECT KNOWLEDGE Chunk N]`, `Source: <path>`, `Relevance Score: <score>`).
- Provided `enhanceContext()` helper for cleanly combining base agent notes with retrieved project knowledge context.
- Zero existing agent interfaces or graph structures were modified, maintaining 100% backward compatibility.

Verification:
- TypeScript build check (`npx tsc --project tsconfig.agentic.json --noEmit`): Passed with 0 errors.
- TypeScript build check (`npx tsc --noEmit`): Passed with 0 errors.
- Feature 20 unit tests (`npx tsx rag/projectKnowledge.test.ts`): 5/5 passed.
- Aegis Master Test Runner (`npx tsx testAll.ts`): 20/20 test suites passed (0 failures).

---

### Feature 21 — Short-Term Memory & Feature 22 — Long-Term Memory

Files created/modified:
- `memory/types.ts` [NEW] — Short-term entry & category schemas, long-term record & category schemas, memory query options, formatted context options.
- `memory/short-term/shortTermMemory.ts` [NEW] — `ShortTermMemory` service providing run-isolated execution scratchpad and temporary key-value state (`set`, `get`, `getCategory`, `getAll`, `search`, `delete`, `clear`).
- `memory/long-term/longTermMemory.ts` [NEW] — `LongTermMemory` service providing persistent storage of architectural decisions, preferences, and project patterns with JSON file backup (`memory/long-term/storage.json`), automatic disk rehydration, and CRUD query operations.
- `memory/memoryManager.ts` [NEW] — Unified `MemoryManager` API exposing `shortTerm` and `longTerm` memory sub-systems plus `getFormattedMemoryContext()` builder.
- `memory/index.ts` [NEW] — Public barrel export for Aegis memory module.
- `graph/state.ts` [MODIFIED] — Added `runId` and `memoryContext` fields to `AegisStateAnnotation`.
- `memory/memory.test.ts` [NEW] — 7-block test suite verifying short-term memory CRUD, run isolation, long-term CRUD, disk persistence across process restarts, memory manager formatting, RAG vs Memory distinction, and agent access integration.
- `testAll.ts` [MODIFIED] — Registered `memory/memory.test.ts` in master runner.
- `graph/test.ts` & `graph/edges/agentRouter.test.ts` [MODIFIED] — Added `runId` and `memoryContext` to test state builders.
- `AGENT_BUILD_CONTEXT.md` [MODIFIED] — Updated progress and documented completed features.

Key Decisions:
- **Strict Layer Separation**: Short-term memory is strictly execution-scoped and isolated per `runId`. Long-term memory is persistent across runs and process restarts via file-backed JSON store with DB compatibility.
- **RAG vs Memory Distinction**:
  - RAG: Codebase documents / file vector embeddings ("What information exists in project knowledge?").
  - Short-Term Memory: Active run scratchpad & execution status ("What is happening in this execution?").
  - Long-Term Memory: Persistent architectural decisions & project rules ("What useful information/decisions should Aegis remember?").
- **Non-Intrusive Agent Access**: Memory is exposed via unified `MemoryManager` and formatted context helper `getFormattedMemoryContext()`. Memory is not blindly dumped into every prompt; agents/nodes retrieve memory context as required.
- **Zero Breaking Changes**: Preserved 100% backward compatibility with all Features 01–20.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit`): Passed with 0 errors.
- TypeScript compilation (`npx tsc --noEmit`): Passed with 0 errors.
- Memory unit tests (`npx tsx memory/memory.test.ts`): 7/7 passed.
- Master test runner (`npx tsx testAll.ts`): 21/21 test suites passed (0 failures).

---

### Feature 23 — Human-in-the-Loop

Files created/modified:
- `graph/approvalTypes.ts` [NEW] — `ApprovalType`, `ApprovalRiskLevel`, `ApprovalRequest`, `ApprovalDecision`, `CreateApprovalRequestOptions`.
- `graph/state.ts` [MODIFIED] — Added `"paused"` to `ExecutionStatus`, added `pendingApproval` & `approvalDecision` annotations to `AegisStateAnnotation`.
- `graph/edges/approvalGate.ts` [NEW] — Policy engine helper `requiresApproval(action, options)` and factory `createApprovalRequest(options)`.
- `graph/approvalWorkflow.ts` [NEW] — Approval-aware LangGraph workflow compiled with `MemorySaver` checkpointer, approval check gate node, graph interruption, and decision resolution helpers (`executeApprovalWorkflow`, `resolveApprovalAndResume`).
- `graph/index.ts` [MODIFIED] — Re-exported approval types, approval gate, and approval workflow runtime.
- `apps/api/services/agentService.ts` [MODIFIED] — Connected `startTask` and `resumeRun` to real approval workflow runtime engine.
- `apps/api/controllers/approvals.ts` [MODIFIED] — Updated `resolveApproval` controller to pass human decisions (`action` & `reason`) to `agentService.resumeRun`.
- `graph/approvalWorkflow.test.ts` [NEW] — 5-block test suite verifying safe action detection, protected action approval request creation, graph interruption/pausing (`status: "paused"`), human APPROVE resume execution, human REJECT action prevention, and state preservation.
- `testAll.ts` [MODIFIED] — Registered `graph/approvalWorkflow.test.ts` in master test runner.
- `graph/test.ts` & `graph/edges/agentRouter.test.ts` [MODIFIED] — Added `pendingApproval` & `approvalDecision` fields to test state builders.
- `AGENT_BUILD_CONTEXT.md` [MODIFIED] — Updated Feature 23 progress.

Key Decisions:
- **Genuine Graph Interruption**: Uses LangGraph's `MemorySaver` checkpointer and `status: "paused"` state annotation. Execution genuinely halts rather than simulating approval.
- **Human Decision Handling**:
  - `APPROVE`: Resumes graph execution from checkpoint with `approvalDecision` attached and executes protected file/command changes.
  - `REJECT`: Resumes graph execution, **skips/prevents** execution of protected changes, logs human refusal context in state, and terminates cleanly (`status: "completed"` with refusal error log).
- **Backend API Cohesion**: Integrated directly with existing backend controllers (`apps/api/controllers/approvals.ts`) and API service boundaries (`apps/api/services/agentService.ts`) with zero duplicate approval endpoints created.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit`): Passed with 0 errors.
- TypeScript compilation (`npx tsc --noEmit`): Passed with 0 errors.
- Feature 23 unit tests (`npx tsx graph/approvalWorkflow.test.ts`): 5/5 passed.
- Aegis Master Test Runner (`npx tsx testAll.ts`): 22/22 test suites passed (0 failures).

---

### Feature 24 — Tool Permissions / Guardrails

Files created/modified:
- `tools/guardrails/types.ts` [NEW] — `ToolCategory`, `PermissionDecision`, `PermissionEvaluationInput`, `PermissionEvaluationResult`, `GuardrailOptions`.
- `tools/guardrails/policyEngine.ts` [NEW] — `classifyToolAction`, `isDangerousAction`, `evaluatePermission` policy rules.
- `tools/guardrails/enforcer.ts` [NEW] — `enforceToolGuardrail(input)` enforcement entry point.
- `tools/guardrails/index.ts` [NEW] — Module barrel export.
- `tools/filesystem/index.ts` [MODIFIED] — Enforced `enforceToolGuardrail` directly inside `writeFile`, `deleteFile`, `createDir`, and `safePath` file I/O operations.
- `tools/terminal/index.ts` [MODIFIED] — Enforced `enforceToolGuardrail` directly inside `runCommand` before child process execution.
- `tools/index.ts` [MODIFIED] — Re-exported guardrails module.
- `tools/guardrails/guardrails.test.ts` [NEW] — 8-block test suite verifying read-only allow, safe mutation allow, sensitive require-approval, approved execution, rejected non-execution, dangerous command block (`rm -rf /`, `format C:`), path escape block (`../../etc/passwd`), and direct tool invocation interception.
- `testAll.ts` [MODIFIED] — Registered `tools/guardrails/guardrails.test.ts` in master test runner.
- `AGENT_BUILD_CONTEXT.md` [MODIFIED] — Updated Feature 24 progress.

Key Decisions:
- **Direct Tool Enforcement**: Guardrails are wired directly into low-level tools (`writeFile`, `deleteFile`, `runCommand`) so agents cannot bypass safety checks by invoking tools directly.
- **Explicit Safety Policy**:
  - `ALLOW`: Read-only and safe mutations execute immediately.
  - `REQUIRE_APPROVAL`: Sensitive operations invoke Feature 23 Human-in-the-Loop approval gate.
  - `BLOCK`: Dangerous system commands and path escape attempts are denied immediately with `ERR_DANGEROUS_ACTION_BLOCKED`.
- **Zero Duplication**: Reuses Feature 23 approval infrastructure without creating duplicate approval mechanisms.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit`): Passed with 0 errors.
- TypeScript compilation (`npx tsc --noEmit`): Passed with 0 errors.
- Feature 24 unit tests (`npx tsx tools/guardrails/guardrails.test.ts`): 8/8 passed.
- Aegis Master Test Runner (`npx tsx testAll.ts`): 23/23 test suites passed (0 failures).

---

### Feature 25 — GitHub Integration

Files created/modified:
- `tools/github/client.ts` [NEW] — `GitHubClient` REST client using Node native `fetch` with error normalization & credential masking. Supports live unauthenticated reads to public repos and authenticated reads/writes.
- `tools/github/index.ts` [NEW] — `GithubInputSchema`, `githubTool`, and `executeGithubOperation` with Feature 24 guardrail enforcement.
- `apps/api/controllers/projects.ts` [MODIFIED] — Added `getProjectGithubData` controller to fetch live real-time GitHub repository status (`stars`, `forks`, `openIssues`, `defaultBranch`, `url`) from `api.github.com`.
- `apps/api/routes/projects.ts` [MODIFIED] — Registered route `GET /api/projects/:id/github`.
- `demoGithub.ts` [REFACTORED] — Completely eliminated all hardcoded mock/fake fallback data (`ghp_mock_demo_token`, fake static JSON objects); all executions hit live `https://api.github.com` REST endpoints.
- `tools/guardrails/policyEngine.ts` [MODIFIED] — Registered 10 GitHub read actions in `READ_ONLY_ACTIONS`, 3 GitHub write actions in `SENSITIVE_MUTATION_ACTIONS`, and administrative actions in `isDangerousAction`.
- `tools/index.ts` [MODIFIED] — Re-exported GitHub tool module.
- `tools/github/github.test.ts` [NEW] — 7-level comprehensive test suite (Unit & Validation, Client & Error Normalization, Permission & Zero-Bypass Test, Agent Integration, Graph Workflow Integration, Multi-Agent System Integration, Security Audit & E2E Verification).
- `testAll.ts` [MODIFIED] — Registered `tools/github/github.test.ts` in master test runner.
- `AGENT_BUILD_CONTEXT.md` [MODIFIED] — Updated Feature 25 progress.

Key Decisions:
- **Zero Hardcoded/Fake Data**: All production tool executions and scripts make real live HTTP calls to `api.github.com`. No mock/demo static JSON fallbacks exist.
- **Backend API Integration**: Exposed `GET /api/projects/:id/github` to serve live GitHub metadata to Aegis backend and frontend interfaces without leaking credentials.
- **Strict Guardrail & Zero-Bypass Protection**: All GitHub mutations pass through Feature 24 `enforceToolGuardrail()`. When unapproved or denied, the GitHub HTTP client is **never** invoked.
- **Strict Credential Protection**: `GITHUB_TOKEN` is loaded securely from environment (`process.env.GITHUB_TOKEN`) and stripped/masked from all error strings, tool outputs, logs, WebSocket payloads, and thrown exceptions.

Verification:
- TypeScript compilation (`npx tsc --project tsconfig.agentic.json --noEmit`): Passed with 0 errors.
- TypeScript compilation (`npx tsc --noEmit`): Passed with 0 errors.
- Real Live Script (`npx tsx demoGithub.ts`): Connected live to `api.github.com` (fetched live stars, commits, branches).
- Feature 25 test suite (`npx tsx tools/github/github.test.ts`): 7/7 test levels passed.
- Aegis Master Test Runner (`npx tsx testAll.ts`): 24/24 test suites passed (0 failures).





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
