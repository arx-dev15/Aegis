# AEGIS Architecture

## 1. Purpose

This document defines the intended architecture of AEGIS and provides a place to record the verified runtime architecture.

The architecture must support the core AEGIS workflow:

> Understand → Plan → Research → Architect → Implement → Test → Review → Secure → Approve → Verify → Learn

This document describes architecture. It is **not proof that a component is currently integrated or working**.

Actual repository code and runtime behavior remain the source of truth.

---

# 2. Core Product Architecture

The intended AEGIS product flow is:

```text
                    User
                     │
                     ▼
             Web / API / CLI
                     │
                     ▼
              AEGIS Core
              Task Entry
                     │
                     ▼
             Workflow / Graph
                     │
                     ▼
       Repository Context / Intelligence
                     │
                     ▼
      ┌──────────────────────────────┐
      │      Engineering Agents      │
      │                              │
      │ Planner                      │
      │ Researcher                   │
      │ Architect                    │
      │ Developer                    │
      │ Tester                       │
      │ Reviewer                     │
      │ Security                     │
      └──────────────────────────────┘
                     │
                     ▼
              Human Approval
                     │
                     ▼
             Controlled Tools
                     │
                     ▼
        Real Repository Changes
                     │
                     ▼
              Test / Review
                     │
                     ▼
               Security
                     │
                     ▼
              Verification
                     │
                     ▼
           Result + Evidence

This is the target architecture, not a claim that the complete flow is currently operational.

3. Architectural Principles

AEGIS should follow these principles:

Repository-first

The repository is the primary engineering context.

Agents should work from actual:

files
symbols
imports
APIs
database structures
dependencies
tests
Git history
relationships
runtime evidence

Generic knowledge should supplement repository evidence, not replace it.

Explicit data flow

Important information should move through explicit state and structured outputs.

Avoid hidden communication between components.

Controlled execution

Agents should not freely perform arbitrary destructive operations.

Execution should pass through controlled tools and approval gates where required.

Real integrations

GitHub, filesystem, terminal, database, browser, and other integrations must represent real capabilities.

No fake production integrations or hardcoded success responses.

Shared core

Web, API, and CLI should ultimately invoke the same AEGIS core rather than implementing separate versions of the workflow.

Verification

A successful agent response or tool call does not mean an engineering task succeeded.

AEGIS must verify the resulting repository state.

Simplicity

Do not introduce abstractions merely because they are architecturally possible.

The architecture should remain understandable to a developer working directly in the repository.

4. Major Architectural Domains

The current repository contains the following major domains:

apps/
agents/
graph/
tools/
repo-intelligence/
rag/
memory/
models/
evaluation/
observability/
database/
shared/
docker/

These domains are retained during the MVP integration phase.

Do not redesign the directory structure during MVP integration.

Architecture simplification is a later phase.

5. Application Layer
apps/web/
apps/api/
Web

Responsible for the user-facing AEGIS interface.

Potential responsibilities:

task submission
repository selection
workflow visibility
approval interaction
execution status
results
evidence
diffs
API

Responsible for exposing AEGIS capabilities to clients.

Potential responsibilities:

task/session creation
workflow execution
repository operations
approval operations
status/result retrieval
integration endpoints

The exact runtime responsibilities must be verified against the repository.

Current verification status: PENDING PHASE 1 AUDIT

6. AEGIS Core / Workflow Layer

The workflow is orchestrated through LangGraph.

Conceptually:

Task
  │
  ▼
Context
  │
  ▼
Investigation
  │
  ▼
Planning
  │
  ▼
Approval
  │
  ▼
Implementation
  │
  ▼
Testing
  │
  ▼
Review
  │
  ▼
Security
  │
  ▼
Verification

The graph is responsible for:

state
routing
agent execution
transitions
retries/recovery
workflow progression

The exact production entry point and runtime path must be established during the system audit.

Current verification status: PENDING PHASE 1 AUDIT

7. Agent Layer

Primary engineering agents:

Planner
Researcher
Architect
Developer
Tester
Reviewer
Security

Each agent should have a clearly defined responsibility.

Agents should not duplicate capabilities unnecessarily.

Conceptually:

Agent	Responsibility
Planner	Convert engineering intent into an actionable plan
Researcher	Investigate repository and external context
Architect	Determine appropriate technical approach
Developer	Implement approved changes
Tester	Execute and analyze tests
Reviewer	Inspect implementation and changes
Security	Identify security issues and risks

The existence of an agent does not prove that the agent participates in the real MVP workflow.

Integration must be verified.

8. Repository Intelligence

Repository Intelligence is a core AEGIS capability.

The intended system progressively understands:

Files
 ↓
Symbols
 ↓
Imports / Exports
 ↓
APIs
 ↓
Database
 ↓
Dependencies
 ↓
Tests
 ↓
Git History
 ↓
Relationships
 ↓
Impact

The long-term objective is a useful representation of the repository rather than simple document retrieval.

Repository Intelligence should eventually answer questions such as:

Where is this behavior implemented?
What depends on this file?
Which APIs are affected?
Which tests cover this behavior?
What database structures are involved?
What could this change break?
What code is relevant to this task?

Current maturity must be established by the Phase 1 audit.

9. RAG

RAG is a supporting capability rather than the product itself.

The intended direction is:

Repository
     │
     ▼
Parsing / Indexing
     │
     ▼
Structured Repository Knowledge
     │
     ▼
Retrieval
     │
     ▼
Task-Relevant Context
     │
     ▼
Agents

RAG should become increasingly:

repository-aware
relationship-aware
metadata-aware
task-aware

AEGIS should avoid retrieving large amounts of irrelevant code.

Current integration status: TO BE VERIFIED

10. Tools

Tools provide controlled capabilities to agents.

Major tool categories include:

Filesystem
GitHub
Search
Terminal
Database
Browser

Tools should:

perform real operations
validate inputs
expose clear outputs
enforce relevant safety policies
report failures explicitly

Tools are capabilities.

They are not the workflow themselves.

The graph and agents must actually invoke the appropriate tools for a real engineering task.

11. Approval and Safety

Meaningful risky or destructive operations require human approval.

Conceptually:

Agent requests action
        │
        ▼
   Risk assessment
        │
        ▼
 ┌───────────────┐
 │ Approval needed│
 └───────┬───────┘
         │
         ▼
       Human
         │
    ┌────┴────┐
    │         │
  Approve    Reject
    │         │
    ▼         ▼
 Execute     Stop

AEGIS must not bypass approval simply to make the workflow appear autonomous.

Execution must remain observable and verifiable.

12. Execution Model

The intended execution model is:

Engineering Task
      │
      ▼
Understand Repository
      │
      ▼
Investigate
      │
      ▼
Plan
      │
      ▼
Human Approval
      │
      ▼
Implement
      │
      ▼
Run Tests
      │
      ├── Failure ──► Analyze Failure
      │                    │
      │                    ▼
      │                 Recover
      │                    │
      │                    ▼
      │                 Re-test
      │
      ▼
Review
      │
      ▼
Security
      │
      ▼
Verify
      │
      ▼
Evidence / Result

Failure recovery should preserve useful context.

A failure should not automatically restart the entire workflow from the beginning.

13. Shared Core

The intended relationship between clients is:

              ┌───────────┐
              │  Web      │
              └─────┬─────┘
                    │
              ┌─────▼─────┐
              │    API    │
              └─────┬─────┘
                    │
              ┌─────▼─────┐
              │    CLI    │
              └─────┬─────┘
                    │
                    ▼
             ┌──────────────┐
             │ AEGIS Core   │
             └──────┬───────┘
                    │
                    ▼
              Workflow/Graph

Web, API, and CLI should not develop independent workflow implementations.

They should use the same underlying AEGIS execution model.

Current CLI/core integration status: PENDING VERIFICATION

14. External Integrations

GitHub and other external systems are controlled knowledge/execution surfaces.

GitHub integration must operate against real repositories and real GitHub data.

Credentials and tokens must remain server-side.

External results must not be fabricated.

The exact current integration boundaries must be verified during the runtime audit.

15. Data and Persistence

AEGIS contains persistence-related infrastructure under:

database/
memory/

Conceptually:

Short-term execution state

Contains information required for the current task/workflow.

Examples:

current task
repository context
agent outputs
tool results
approvals
failures
execution status
Long-term memory

Should contain selective, reusable engineering knowledge.

It should not become an indiscriminate dump of every interaction.

Exact persistence boundaries require repository verification.

16. Models

The model layer provides access to the underlying AI models and related capabilities.

Conceptually:

Agents
  │
  ▼
Model Layer
  │
  ├── LLM
  ├── Structured Output
  └── Embeddings

Agents should depend on the model abstraction rather than duplicating model configuration.

The current implementation must be verified against the repository.

17. Evaluation and Observability

These systems support product verification.

Evaluation

Should eventually measure things such as:

task success
workflow correctness
agent behavior
retrieval quality
failure recovery
regression behavior
Observability

Should make it possible to understand:

what AEGIS did
which agent acted
which tools were called
what failed
what changed
how the final result was verified

These capabilities should support engineering debugging rather than exist only as isolated infrastructure.

18. Current Architecture vs Intended Architecture

This distinction is mandatory.

Intended

The architecture described above represents the target AEGIS product.

Current Verified

The actual runtime architecture must be determined from:

repository source code
actual entry points
graph execution
agent invocation
tool invocation
repository operations
test execution
approval behavior
verification behavior

Until the Phase 1 audit is complete:

Do not mark the intended architecture as fully integrated.

A component can be:

NOT IMPLEMENTED
STUB
IMPLEMENTED
INTEGRATED
VALIDATED
BROKEN
UNKNOWN

These states must be based on evidence.

19. MVP Architecture

The minimum architecture that must actually work is:

User
 │
 ▼
Real Entry Point
 │
 ▼
Task
 │
 ▼
Real Repository
 │
 ▼
Repository Context
 │
 ▼
Investigation / Planning
 │
 ▼
Approval
 │
 ▼
Implementation
 │
 ▼
Real File Changes
 │
 ▼
Real Tests
 │
 ▼
Review / Security
 │
 ▼
Verification
 │
 ▼
Result + Evidence

The MVP is successful only when this path works against a real engineering task.

Individual unit tests for agents, tools, or graph nodes are not sufficient evidence.

20. Architecture Simplification

Architecture simplification is intentionally deferred.

After MVP validation, AEGIS will undergo a dedicated audit to identify:

unnecessary files
excessive directory fragmentation
duplicate modules
unnecessary abstractions
dead code
stub code
duplicated configuration
unnecessary wrappers
confusing workflow structure

The goal is:

Same or better capability + fewer unnecessary moving parts + clearer architecture.

No large architectural refactor should be introduced merely because the current structure looks imperfect.

21. Architecture Rule

The repository is the implementation source of truth.

This document describes architectural intent and verified findings.

It must never be used as evidence that a feature works.

Before marking an architectural component as:

INTEGRATED / VALIDATED / COMPLETE

there must be concrete repository or runtime evidence supporting that status.


This is the **Architecture.md reset**. The important part is that it no longer lies about the current state—we'll fill the **verified architecture** from the actual repo audit next.