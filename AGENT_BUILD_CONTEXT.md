# AEGIS — AGENT BUILD CONTEXT

This file is the persistent engineering context for AEGIS.

Every AI coding agent working on AEGIS MUST read this file before
planning or modifying the project.

This file defines:

- AEGIS product identity
- current development milestone
- current implementation state
- MVP definition
- development rules
- integration rules
- verification rules
- architecture constraints
- agent responsibilities
- repository intelligence direction
- safety rules
- feature history
- paused roadmap
- architecture refactoring policy

The actual repository/source code is the implementation source of truth.

This document describes the intended product and engineering rules.

If this document conflicts with the actual repository:
1. Inspect the repository.
2. Identify the discrepancy.
3. Do not silently assume either side is correct.
4. Report the discrepancy.
5. Update this document only after the actual state is established.

If the project owner explicitly changes a decision, the newer explicit
decision takes precedence.


============================================================
1. PROJECT IDENTITY
============================================================

Project:

AEGIS

Definition:

AEGIS is an AI Engineering Operating System that understands a software
repository, reasons about engineering tasks and changes, orchestrates
specialized engineering agents, safely executes approved actions, and
verifies the resulting work.

AEGIS is NOT:

- a generic chatbot
- a generic RAG application
- a collection of independent LLM agents
- a GitHub dashboard
- a code-generation wrapper
- a generic agent framework
- a Claude Code clone
- a Coding Harness clone
- an Athena clone

AEGIS is intended to become an engineering system.

Core product idea:

    User gives AEGIS a repository and an engineering task.

    AEGIS:
    - understands the repository
    - investigates the task
    - creates an engineering plan
    - requests approval when required
    - performs approved changes
    - runs appropriate verification
    - reviews the result
    - verifies the final state
    - reports evidence to the user


============================================================
2. CURRENT PROJECT MILESTONE
============================================================

CURRENT MILESTONE:

    MVP VALIDATION

FEATURE DEVELOPMENT IS CURRENTLY FROZEN.

Do NOT automatically continue to the next numbered feature.

Do NOT start Feature 28, 29, 30, 31, 32, or 33 simply because they
appear next in the historical roadmap.

The immediate objective is:

    INTEGRATE AND VALIDATE THE EXISTING AEGIS CAPABILITIES.

The project currently contains many implemented components, agents,
tools, workflows, repository intelligence systems, RAG/memory systems,
GitHub integration, and CLI functionality.

However:

    IMPLEMENTED != INTEGRATED != VALIDATED

The existence of individual capabilities does not prove that AEGIS
currently works as one complete engineering system.

The immediate engineering question is:

    "Can AEGIS take a real engineering task against a real repository
     and carry it from request to verified result through the actual
     AEGIS runtime?"

Until that is demonstrated reliably:

    DO NOT MOVE TO NEW ROADMAP FEATURES.


============================================================
3. MVP DEFINITION
============================================================

The AEGIS MVP is:

    Give AEGIS a real repository and a real engineering task.

    AEGIS should:

    1. Understand the repository/context relevant to the task.
    2. Investigate the task.
    3. Produce an actionable engineering plan.
    4. Ask for human approval when the planned action requires it.
    5. Make the approved change to the real repository.
    6. Run appropriate real tests/checks.
    7. Review the resulting change.
    8. Perform required security checks.
    9. Verify the final state.
    10. Return the result and supporting evidence to the user.

Target product workflow:

    USER TASK
        ↓
    REPOSITORY UNDERSTANDING
        ↓
    INVESTIGATION
        ↓
    PLAN
        ↓
    HUMAN APPROVAL
        ↓
    IMPLEMENTATION
        ↓
    TESTING
        ↓
    REVIEW
        ↓
    SECURITY
        ↓
    FINAL VERIFICATION
        ↓
    RESULT + EVIDENCE


Important:

This is the PRODUCT-LEVEL workflow.

Planner, Researcher, Architect, Developer, Tester, Reviewer and
Security are implementation mechanisms used to achieve this workflow.

The user should care about the engineering result, not about the number
of agents involved.


============================================================
4. MVP SUCCESS CRITERIA
============================================================

The MVP is NOT complete because:

- TypeScript compiles.
- Unit tests pass.
- Every agent has a test.
- A showcase script works.
- A demo workflow works.
- A tool works when called directly.
- A repository intelligence script works independently.
- A CLI command works independently.

The MVP requires a real end-to-end workflow.

The following must eventually be demonstrated through the actual AEGIS
runtime:

[ ] A real user can submit an engineering task.

[ ] A real repository can be connected/accessed.

[ ] AEGIS can inspect relevant repository information.

[ ] AEGIS can investigate the engineering task.

[ ] AEGIS produces a meaningful plan.

[ ] The system can pause for required human approval.

[ ] Approved implementation changes the real repository.

[ ] Relevant tests/checks actually execute.

[ ] The resulting change can be reviewed.

[ ] Security checks are performed where appropriate.

[ ] The system verifies the final state.

[ ] The system detects meaningful failures.

[ ] Recovery occurs at the appropriate stage rather than blindly
    restarting everything.

[ ] The final result is returned to the user.

[ ] The result contains useful evidence.

[ ] At least one real engineering task succeeds end-to-end.

[ ] At least one realistic failure/recovery scenario is validated.

[ ] The workflow uses the real AEGIS runtime rather than a dedicated
    showcase/demo path.

Until these conditions are sufficiently demonstrated, AEGIS remains in:

    MVP VALIDATION


============================================================
5. PRODUCT PRINCIPLE
============================================================

AEGIS optimizes for:

    ENGINEERING USEFULNESS

not:

    FEATURE COUNT

A capability is valuable only if it contributes to the engineering
workflow or provides a clearly useful product capability.

Do not implement capabilities merely because they are interesting,
popular, technically impressive, or present in another agent system.


============================================================
6. CAPABILITY STATUS MODEL
============================================================

Every meaningful AEGIS capability has separate maturity states.

IMPLEMENTED

Means:

- code exists
- isolated behavior has been implemented
- appropriate component-level verification exists

IMPLEMENTED does NOT mean product integration.

INTEGRATED

Means:

- the capability is connected to the real AEGIS runtime
- the intended workflow actually invokes/consumes it
- data flows correctly across the integration boundary

VALIDATED

Means:

- the integrated capability has successfully performed its intended
  responsibility during a realistic engineering workflow

COMPLETE

A product capability should only be considered COMPLETE when it is:

    INTEGRATED + VALIDATED

Other possible states:

- NOT IMPLEMENTED
- STUB
- MOCK
- BROKEN
- PARTIAL
- IMPLEMENTED
- INTEGRATED
- VALIDATED
- DEFERRED
- UNUSED

Never use "implemented" as a synonym for "complete."


============================================================
7. COMPLETION EVIDENCE RULE
============================================================

Do NOT mark a capability complete merely because:

- a unit test passes
- a build passes
- TypeScript compiles
- an isolated script works
- a demo works
- a mock workflow works
- a component can be called directly
- an agent returns valid structured output

These prove component behavior.

For product-level completion, demonstrate:

    REAL INPUT
        ↓
    REAL AEGIS RUNTIME
        ↓
    REAL INTEGRATION
        ↓
    REAL RESULT

When practical, record evidence such as:

- runtime entry point
- relevant files/functions
- actual execution performed
- repository used
- task performed
- tool calls made
- files changed
- tests executed
- final result


============================================================
8. CURRENT DEVELOPMENT RULE
============================================================

For the current MVP phase, work in this order:

    INSPECT
        ↓
    IDENTIFY GAP
        ↓
    PLAN
        ↓
    IMPLEMENT MINIMUM REQUIRED CHANGE
        ↓
    INTEGRATE
        ↓
    VERIFY
        ↓
    UPDATE STATE

Do not begin with:

    "What feature should we build next?"

Begin with:

    "What prevents the current AEGIS product workflow from working?"


============================================================
9. MVP-FIRST DEVELOPMENT RULE
============================================================

During MVP validation:

DO:

- integrate existing capabilities
- repair broken connections
- remove accidental duplicate paths
- fix incorrect state/data flow
- connect agents to the actual workflow
- connect repository intelligence to actual reasoning
- connect tools to actual execution
- connect testing to actual changes
- connect review/security to actual diffs
- improve the actual user-facing flow
- fix failures discovered during real execution

DO NOT:

- add unrelated roadmap features
- build infrastructure merely because it is planned
- implement MCP because it is next
- implement sessions because they are planned
- implement observability merely because it is planned
- implement evaluation merely because it is planned
- perform the architecture simplification prematurely


============================================================
10. INTEGRATION-FIRST RULE
============================================================

Before implementing a new capability, answer:

1. What user/product problem does this solve?
2. Where does it enter the real AEGIS workflow?
3. What component consumes it?
4. What does it depend on?
5. Why can existing functionality not satisfy the requirement?
6. How will integration be verified?
7. Is it actually required for the current milestone?

If these questions cannot be answered clearly:

    DO NOT IMPLEMENT THE CAPABILITY YET.

Prefer:

    EXISTING CAPABILITY
        ↓
    INTEGRATE
        ↓
    VALIDATE

over:

    EXISTING CAPABILITY
        +
    NEW DUPLICATE CAPABILITY


============================================================
11. REAL WORKFLOW RULE
============================================================

Production AEGIS workflows must operate on real inputs and real system
state.

Do not satisfy product integration requirements using:

- hardcoded results
- fake repository data
- fake GitHub data
- fake commits
- fake PRs
- fake issues
- static repository lists
- simulated successful tool responses
- fake agent outputs
- demo-only execution paths
- placeholder production logic
- silent fallbacks to fake data

Mocks are allowed only where explicitly isolated for tests.

A demo can prove an isolated capability.

A demo does NOT prove production integration.


============================================================
12. NO SILENT FAILURE
============================================================

Failures must be explicit.

Bad:

    GitHub request fails
        ↓
    return fake repository

Bad:

    repository scan fails
        ↓
    continue as if repository was understood

Bad:

    test execution fails
        ↓
    report success

Good:

    operation fails
        ↓
    capture failure
        ↓
    preserve useful diagnostics
        ↓
    route to appropriate recovery/termination path
        ↓
    report actual state


============================================================
13. ONE SHARED AEGIS CORE
============================================================

Web, API and CLI should use the same underlying AEGIS core.

Conceptually:

    Web
      \
       API / CLI
           ↓
       AEGIS CORE
           ↓
       LangGraph
           ↓
       Agents / Tools / Repository Intelligence
           ↓
       Execution
           ↓
       Verification

Do not create separate agent implementations for:

- Web
- API
- CLI

The interface may differ.

The engineering runtime should remain shared.


============================================================
14. CURRENT ARCHITECTURE BASELINE
============================================================

The existing architecture is the CURRENT BASELINE.

Do not redesign the architecture during MVP integration unless the
current architecture itself prevents the required workflow.

Current conceptual structure:

    aegis/
    ├── apps/
    │   ├── web/
    │   └── api/
    │
    ├── agents/
    │   ├── planner/
    │   ├── researcher/
    │   ├── architect/
    │   ├── developer/
    │   ├── tester/
    │   ├── reviewer/
    │   └── security/
    │
    ├── graph/
    ├── tools/
    ├── rag/
    ├── memory/
    ├── models/
    ├── evaluation/
    ├── observability/
    ├── database/
    ├── shared/
    └── docker/

This is NOT a permanent promise that every directory must remain
unchanged forever.

Architecture simplification is planned later.

During MVP work:

    PRESERVE FIRST.
    SIMPLIFY LATER.


============================================================
15. ARCHITECTURE PRINCIPLE
============================================================

The target architecture should be:

    MODULAR
    but not
    FRAGMENTED

Avoid:

- one tiny file for every trivial function
- excessive barrel files
- unnecessary nesting
- duplicate wrappers
- duplicate types
- unnecessary interfaces
- unnecessary factories
- unnecessary service layers
- abstractions with no meaningful consumer

Prefer:

- cohesive modules
- explicit data flow
- simple functions
- clear responsibilities
- readable TypeScript
- understandable boundaries


============================================================
16. ARCHITECTURE REFACTOR POLICY
============================================================

Architecture simplification is intentionally DEFERRED until after MVP
validation.

The eventual refactor should:

- audit the entire repository
- map responsibilities
- identify duplication
- identify dead code
- identify stubs/mocks
- identify unnecessary abstractions
- identify fragmented modules
- simplify directory structure
- consolidate cohesive modules where appropriate
- preserve validated functionality
- preserve required APIs
- preserve tests
- run regression verification

Goal:

    SAME OR BETTER CAPABILITY
    +
    FEWER UNNECESSARY MOVING PARTS
    +
    CLEARER ARCHITECTURE

Do not refactor merely for aesthetics.

Do not perform architecture simplification during MVP integration
unless explicitly required.


============================================================
17. LANGGRAPH / ORCHESTRATION
============================================================

LangGraph is the orchestration layer.

It should manage:

- state
- nodes
- transitions
- conditional routing
- loops
- retries
- recovery
- checkpoints where appropriate
- human approval pauses where appropriate

AEGIS should not be a collection of unrelated LLM calls.

Core mental model:

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
    Completion / Recovery


============================================================
18. AGENT RESPONSIBILITIES
============================================================

Agents have engineering responsibilities.

Planner:

- understands the requested engineering outcome
- creates a plan
- identifies major work

Researcher:

- investigates the repository/task
- retrieves relevant evidence
- identifies existing behavior

Architect:

- reasons about design and change impact
- identifies affected components
- considers tradeoffs

Developer:

- implements approved changes
- uses controlled tools
- works against the real repository

Tester:

- identifies/runs appropriate tests
- reports actual results
- supports failure feedback

Reviewer:

- reviews the actual change/diff
- checks correctness and maintainability
- identifies issues

Security:

- checks relevant security risks
- reviews dangerous or sensitive changes
- identifies security concerns

Agents should not perform responsibilities that belong to unrelated
agents merely because it is convenient.

However, the workflow does not require every task to invoke every agent.

Routing should depend on engineering intent and task requirements.


============================================================
19. ENGINEERING INTENT
============================================================

The user should communicate engineering intent rather than low-level
tool instructions.

User:

    "Fix the authentication issue."

AEGIS should determine:

- what needs to be inspected
- which repository areas matter
- which agents are needed
- which tools are needed
- which tests matter
- what risks exist
- whether approval is required

The system should not require the user to manually orchestrate:

    read file
    search symbol
    run test
    inspect middleware
    edit service


============================================================
20. REPOSITORY INTELLIGENCE
============================================================

Repository understanding is a core AEGIS capability.

The long-term goal is not merely semantic file search.

AEGIS should progressively understand:

- files
- directories
- symbols
- functions
- classes
- imports
- exports
- dependencies
- APIs
- database structures
- configuration
- tests
- Git history
- issues
- pull requests
- CI/workflows
- relationships between these entities

Example:

    POST /login
        ↓
    authController
        ↓
    authService
        ↓
    userRepository
        ↓
    PostgreSQL

And:

    authService
        ↓
    JWT utility
        ↓
    auth middleware
        ↓
    protected routes


============================================================
21. REPOSITORY DIGITAL TWIN
============================================================

Long-term direction:

AEGIS should maintain a useful engineering representation of a
repository.

Conceptually:

    Repository
    ├── Files
    ├── Directories
    ├── Symbols
    ├── APIs
    ├── Database
    ├── Config
    ├── Tests
    ├── Dependencies
    ├── Git history
    ├── Issues
    ├── PRs
    └── Relationships

The purpose is to answer:

- What exists?
- How does it work?
- What depends on it?
- Where is it used?
- What will be affected by changing it?
- Which tests cover it?
- What changed historically?
- Where should a new change be made?


============================================================
22. CODEBASE-AWARE RAG
============================================================

AEGIS RAG should evolve beyond:

    query
      ↓
    similar chunks
      ↓
    answer

Target:

    engineering intent
        ↓
    relevant entities
        ↓
    relevant code
        ↓
    relationships
        ↓
    configuration
        ↓
    tests
        ↓
    history
        ↓
    reasoning
        ↓
    answer / action

Do not blindly retrieve large amounts of code.

Retrieve relevant context based on:

- task
- entities
- relationships
- dependencies
- repository structure
- change impact


============================================================
23. CHANGE IMPACT
============================================================

Before meaningful changes, AEGIS should eventually reason about impact.

Example:

    Change User.email
        ↓
    database schema
        ↓
    migration
        ↓
    ORM
        ↓
    repository
        ↓
    service
        ↓
    controller
        ↓
    API
        ↓
    frontend
        ↓
    tests

Potential output:

    affected components
    compatibility concerns
    migration requirements
    relevant tests
    risk areas

Do not claim impact analysis is production-complete until it has been
validated against real repositories.


============================================================
24. GITHUB
============================================================

GitHub is both:

1. a repository knowledge source
2. a controlled engineering execution surface

The existing GitHub integration is intended to use REAL GitHub data.

Never regress it into fake/demo production behavior.

Production must not use:

- fake repositories
- fake commits
- fake branches
- fake PRs
- fake issues
- fake repository lists
- placeholder responses

Authentication/tokens must remain server-side.

Potential future capabilities:

- repository inspection
- branch inspection
- file retrieval
- commits
- PRs
- issues
- reviews
- diffs
- CI/workflow results
- branch comparisons
- branch creation
- commits
- PR creation
- PR comments/reviews

Meaningful write operations require appropriate safety controls.


============================================================
25. TOOLS
============================================================

Tools are how AEGIS interacts with the engineering environment.

Conceptual tools:

- filesystem
- terminal
- GitHub
- search
- database
- browser/web
- test runner
- Git

Agents must not magically perform external actions outside the
controlled tool system.

Before adding a new tool:

1. Inspect existing tools.
2. Check whether an existing tool can be extended.
3. Avoid duplicate implementations.
4. Define its responsibility clearly.
5. Define safety requirements.
6. Integrate it into an actual workflow.


============================================================
26. FILESYSTEM
============================================================

Filesystem capabilities include:

- read
- write
- edit
- directory inspection
- repository search

Future destructive operations should have stricter safety controls.

Never silently modify unrelated files.

Never silently delete important project data.


============================================================
27. TERMINAL / COMMAND EXECUTION
============================================================

Terminal execution is currently PAUSED as a roadmap feature unless
MVP validation proves it is required.

When implemented, terminal execution must:

- use explicit command execution
- enforce workspace boundaries where appropriate
- enforce policy
- support approval for dangerous operations
- enforce timeouts
- protect secrets
- report actual command results

Dangerous operations must not be blindly executed.

Examples:

- destructive filesystem commands
- database destruction
- force pushes
- production deployment
- destructive migrations


============================================================
28. HUMAN APPROVAL
============================================================

AEGIS must distinguish:

    UNDERSTAND
    ANALYZE
    PROPOSE
    APPROVE
    EXECUTE

Human approval is required for meaningful risky/destructive actions.

Examples may include:

- destructive file operations
- production changes
- dangerous database changes
- force push
- branch deletion
- deployment
- protected branch operations

Approval should be part of the actual runtime workflow, not merely a
UI placeholder.


============================================================
29. SAFETY MODEL
============================================================

Conceptually:

    READ
      ↓
    ANALYZE
      ↓
    PROPOSE
      ↓
    APPROVAL
      ↓
    WRITE / EXECUTE
      ↓
    VERIFY

Do not bypass approval simply to make the system appear autonomous.


============================================================
30. FAILURE AND RECOVERY
============================================================

Failures should be handled contextually.

Do not restart the entire workflow for every failure.

Example:

    TypeScript compile failure
        ↓
    return to Developer

rather than:

    Planner
      ↓
    Researcher
      ↓
    Architect
      ↓
    Developer

Recovery should preserve useful state where possible.

A successful tool call does not automatically mean the engineering
task succeeded.

The final result must be verified independently.


============================================================
31. VERIFICATION
============================================================

Verification has multiple levels.

STRUCTURAL:

- expected files exist
- imports are correct
- no duplicate implementation
- architecture relationship is correct

BUILD:

- TypeScript
- build
- lint where applicable

UNIT / FEATURE:

- relevant feature-specific tests

RUNTIME:

- execute actual functionality

INTEGRATION:

    interface
      ↓
    API
      ↓
    AEGIS core
      ↓
    graph
      ↓
    agent
      ↓
    tool
      ↓
    external system

END-TO-END:

- real repository
- real task
- real AEGIS runtime
- real changes
- real tests
- real result

For important product capabilities, end-to-end evidence is required.


============================================================
32. INTENDED WORKFLOW VS VERIFIED WORKFLOW
============================================================

Architecture diagrams and workflow documents describe INTENDED
behavior.

They do not prove that the current runtime follows the workflow.

The source of truth for runtime integration is:

    ACTUAL SOURCE CODE
    +
    ACTUAL EXECUTION
    +
    ACTUAL OBSERVED RESULT

Never claim:

    "The architecture shows it, therefore it works."

Instead:

    "The architecture intends this flow; runtime validation proves
     whether the implementation currently follows it."


============================================================
33. WEB UI
============================================================

The Web UI is a user-facing interface to AEGIS.

Potential areas:

- dashboard
- projects
- tasks
- execution
- repository
- GitHub
- approvals
- activity
- results
- sessions

The UI should not contain the core agentic engineering logic.

Existing working UI functionality must be preserved unless a requested
change explicitly requires modification.


============================================================
34. API
============================================================

The API acts as a gateway between interfaces and the AEGIS core.

Conceptually:

    Web / CLI
        ↓
    API
        ↓
    AEGIS Core
        ↓
    Graph / Agents / Tools / Intelligence

Do not duplicate agent logic inside API controllers.


============================================================
35. CLI
============================================================

The CLI is intended to be a first-class AEGIS interface.

The existing CLI foundation exists, but its product-level quality and
integration must be validated.

The CLI must eventually use the shared AEGIS core.

Potential experience:

    $ aegis

    > Fix authentication bug

    AEGIS:
    Investigating repository...

    Plan ready.

    Proceed? y

    Implementing...

    Running tests...

    Verified.


Potential future CLI capabilities:

- interactive sessions
- streaming
- tool activity
- agent progress
- approvals
- headless execution
- session resume
- CI/automation

Do not implement advanced CLI features merely because they are planned.


============================================================
36. MEMORY
============================================================

Short-term memory:

- current task context
- current execution state
- intermediate reasoning/results
- recovery context

Long-term memory:

- stable project decisions
- important engineering conventions
- useful historical knowledge
- durable project facts

Do not store everything.

Memory should be:

- useful
- selective
- retrievable
- maintainable

Memory integration must be validated through actual workflows before
being considered product-complete.


============================================================
37. SESSIONS
============================================================

Persistent sessions are a future capability.

Potential concepts:

- session
- checkpoint
- resume
- branch
- rewind
- history
- parent/child execution

Do not implement session trees merely because another agent runtime has
them.

Implement only when justified by AEGIS product requirements.


============================================================
38. CONTEXT MANAGEMENT
============================================================

Long engineering tasks require context management.

Future capabilities may include:

- relevant-context retrieval
- context compaction
- stale file detection
- session rebuilding
- context prioritization
- summarization

Important principle:

    Do not dump the entire repository into every prompt.

Retrieve what matters when it matters.


============================================================
39. OBSERVABILITY
============================================================

Observability is a future capability unless required for MVP debugging.

Potential telemetry:

- agent runs
- LLM calls
- tool calls
- tokens
- latency
- errors
- retries
- state transitions
- costs
- approvals
- outcomes

Potential technologies may include:

- OpenTelemetry
- Langfuse

Do not add infrastructure merely because it is planned.


============================================================
40. EVALUATION
============================================================

Evaluation is a future capability.

AEGIS should eventually evaluate:

- engineering correctness
- task completion
- tool use
- trajectory
- tests
- review quality
- security
- final outcome

Potential evaluation model:

    LLM evaluation
        +
    deterministic tests
        +
    trajectory evaluation
        +
    tool-use evaluation

Evaluation should measure actual engineering quality, not merely
whether an LLM generated text.


============================================================
41. MCP
============================================================

MCP is a future integration/protocol capability.

Potential uses:

- external tools
- external services
- developer environments

Do not implement MCP merely because it is popular or because it is
next in the old roadmap.

MCP becomes a priority only when it provides clear value to the
current AEGIS product.


============================================================
42. SKILLS
============================================================

Reusable engineering skills are a future capability.

Examples:

- debug-api
- add-api-endpoint
- database-migration
- authentication-fix
- refactor-service
- review-pr
- security-audit

Skills should encode reusable engineering workflows.

They must not become duplicate agent logic.


============================================================
43. LESSONS FROM OTHER AGENT SYSTEMS
============================================================

AEGIS may learn concepts from:

- Coding Harness
- Athena
- Hermes
- Claude Code
- OpenCode
- Kilo
- OpenHands

Do NOT copy their:

- architecture
- code
- naming
- product identity

Useful concepts may include:

- interactive CLI
- headless execution
- context compaction
- session persistence
- branching/rewind
- permission systems
- user steering
- subagents
- skills
- streaming
- memory
- procedural knowledge
- evaluation
- instrumentation
- MCP

These are ideas to evaluate, not requirements.


============================================================
44. AEGIS DIFFERENTIATION
============================================================

The core AEGIS identity is:

    Repository Understanding
            +
    Engineering Intent
            +
    Multi-Agent Reasoning
            +
    Controlled Execution
            +
    Verification

AEGIS should become an engineering intelligence and execution system,
not merely an execution harness.


============================================================
45. DEVELOPMENT STYLE
============================================================

AEGIS is both:

1. a serious engineering project
2. a learning project for its owner

Code must therefore remain understandable.

Prefer:

- TypeScript
- small functions
- clear names
- explicit data flow
- simple types
- cohesive modules
- straightforward control flow

Avoid:

- unnecessary abstractions
- factories everywhere
- excessive dependency injection
- giant interfaces
- unnecessary classes
- deep inheritance
- clever generics
- magic behavior
- premature microservices
- unnecessary distributed systems
- unnecessary wrappers
- duplicate utilities
- duplicate types


============================================================
46. DO NOT OVERENGINEER
============================================================

This is a hard rule.

Before adding:

- abstraction
- dependency
- service
- interface
- factory
- wrapper
- directory
- agent
- workflow
- database table

ask:

    Is this actually necessary?

Prefer the simplest solution that satisfies the real requirement.


============================================================
47. NON-DESTRUCTIVE DEVELOPMENT
============================================================

Before modifying:

    INSPECT
       ↓
    UNDERSTAND
       ↓
    MODIFY

Never assume:

    "rewrite everything"

is the correct solution.

Existing working code is valuable.

Do not replace functioning systems merely because a different
implementation appears cleaner.

Do not silently change unrelated code.


============================================================
48. NO DUPLICATE SYSTEMS
============================================================

Before adding a:

- GitHub service
- repository service
- tool
- memory layer
- model wrapper
- RAG pipeline
- execution system
- approval system

inspect whether an existing implementation already serves the purpose.

Prefer extending existing infrastructure.

If two implementations exist:

    identify which is actually used
    ↓
    preserve behavior
    ↓
    consolidate only when justified


============================================================
49. DEPENDENCY RULE
============================================================

Before installing a package:

1. Inspect package.json.
2. Check whether the capability already exists.
3. Reuse existing dependencies where possible.
4. Avoid duplicate libraries.

Do not introduce a dependency merely for convenience when a simple
existing implementation is sufficient.


============================================================
50. AI CODING RULE
============================================================

AI coding agents are allowed to implement AEGIS.

However, AEGIS is also a learning project.

For important changes, the owner should be able to understand:

- what happens
- why it happens
- where it happens
- how data flows
- what calls what
- what happens on failure
- how the result is verified

Agents should therefore avoid hiding important engineering logic behind
unnecessary abstractions.


============================================================
51. CODING AGENT WORKFLOW
============================================================

Every coding agent MUST:

1. Read this file first.
2. Inspect the existing implementation.
3. Identify the actual current state.
4. Identify the product/workflow requirement.
5. Identify the smallest required change.
6. Reuse existing infrastructure where appropriate.
7. Implement only the required change.
8. Integrate it into the real workflow.
9. Run appropriate verification.
10. Check existing functionality.
11. Update project state when necessary.
12. Report what changed and what was verified.


============================================================
52. BEFORE IMPLEMENTING ANY CHANGE
============================================================

The coding agent should determine:

    What problem are we solving?

    What user/product capability requires this?

    Does the capability already exist?

    Where is the existing implementation?

    Where should it be consumed?

    What is currently disconnected/broken?

    What files actually need modification?

    What is the smallest reasonable change?

    How will we prove it works?


============================================================
53. SCOPE CONTROL
============================================================

One logical engineering change at a time.

Do not silently combine:

- feature implementation
- architecture refactoring
- unrelated bug fixes
- UI redesign
- dependency migration
- file organization cleanup

unless explicitly required.

If a requested change exposes an unrelated architectural problem:

    document it
    ↓
    do not automatically fix it


============================================================
54. FEATURE DEVELOPMENT RULE
============================================================

Historical feature numbers are useful for tracking work.

They are NOT the primary development driver.

During normal feature development after MVP:

    Read context
    ↓
    Inspect existing implementation
    ↓
    Identify gap
    ↓
    Implement feature
    ↓
    Integrate feature
    ↓
    Verify feature
    ↓
    Validate realistic usage
    ↓
    Update status

A feature must have a clear purpose and consumer.


============================================================
55. TESTING RULE
============================================================

For implementation work, use appropriate levels of verification.

Minimum:

- TypeScript/build
- runtime check where applicable
- feature-specific tests

For complex capabilities additionally use:

- structural verification
- integration verification
- end-to-end verification

Do not remove or weaken tests merely to make them pass.

Fix the implementation.


============================================================
56. TEST QUALITY RULE
============================================================

A test is evidence only for what it actually exercises.

Examples:

A unit test proves:

    isolated behavior

An integration test proves:

    connected components

An end-to-end test proves:

    a real workflow path

Do not describe an isolated unit test as proof of end-to-end product
behavior.


============================================================
57. CURRENT MVP VALIDATION METHOD
============================================================

After documentation reset, the next engineering phase is READ-ONLY
SYSTEM AUDIT.

The audit must trace:

    REAL USER ENTRY POINT
        ↓
    TASK CREATION
        ↓
    AEGIS STATE
        ↓
    WORKFLOW
        ↓
    REPOSITORY UNDERSTANDING
        ↓
    AGENTS
        ↓
    TOOLS
        ↓
    APPROVAL
        ↓
    REAL FILE CHANGES
        ↓
    REAL TEST EXECUTION
        ↓
    REVIEW / SECURITY
        ↓
    VERIFICATION
        ↓
    USER RESULT

Do not modify the system during the initial audit.

The audit must identify:

- connected components
- disconnected components
- duplicate paths
- mock/demo paths
- dead paths
- unused implementations
- incorrect routing
- missing state transitions
- missing data flow
- missing verification
- broken user-facing flow


============================================================
58. INTEGRATION GAP PRIORITY
============================================================

When the audit identifies a gap, prioritize:

1. Existing capability that can simply be connected.
2. Existing capability that needs a small correction.
3. Small missing implementation required for integration.
4. Larger architectural change only if unavoidable.

Do not jump directly to rewriting the system.


============================================================
59. MVP REAL-TASK VALIDATION
============================================================

The first real validation must use:

- a real repository
- a real engineering task
- the real AEGIS entry point
- the real workflow
- real tools
- real changes where required
- real tests
- real final verification

Example task:

    "Add a GET /users/:id endpoint and appropriate tests."

Other suitable tasks:

    "Find and fix this failing API test."

    "Trace why authentication is failing and propose a fix."

    "Add validation to this existing endpoint."

The task should be small enough to debug but complex enough to require
real repository understanding and multiple engineering steps.


============================================================
60. FAILURE DURING MVP
============================================================

If the real task fails:

DO NOT immediately add another feature.

Instead:

1. Identify the exact failing stage.
2. Trace the actual runtime path.
3. Determine whether the problem is:
   - missing integration
   - incorrect state
   - incorrect routing
   - broken tool
   - broken agent
   - missing repository context
   - approval problem
   - execution problem
   - testing problem
   - verification problem
4. Fix the smallest responsible component.
5. Re-run the same real task.
6. Record the result.

The real task becomes the integration test for AEGIS.


============================================================
61. PRODUCT VS COMPONENT THINKING
============================================================

Always distinguish:

COMPONENT:

    "The planner can generate a plan."

PRODUCT:

    "When a user gives AEGIS an engineering task, the planning stage
     actually receives the user's task plus relevant repository
     evidence and produces a plan used by the next stage."

COMPONENT:

    "Repository intelligence can find symbols."

PRODUCT:

    "AEGIS uses repository intelligence to investigate the user's
     engineering task."

COMPONENT:

    "Developer can write a file."

PRODUCT:

    "After approval, the real workflow invokes Developer and the
     intended repository change actually occurs."

This distinction is mandatory when evaluating progress.


============================================================
62. HISTORICAL FEATURE LEDGER
============================================================

The following records historical implementation work.

IMPORTANT:

A checked [x] means the feature was implemented and had feature-level
verification at the time.

It does NOT automatically mean the capability is currently:

- integrated
- product-complete
- validated end-to-end

The historical ledger must be preserved.

FOUNDATION

[x] Feature 01 — Gemini Model Layer
[x] Feature 02 — Structured Output
[x] Feature 03 — Tool System
[x] Feature 04 — First Tool-Calling Agent

LANGGRAPH ENGINE

[x] Feature 05 — LangGraph State
[x] Feature 06 — Nodes + Edges + Routing
[x] Feature 07 — Single-Agent Graph
[x] Feature 08 — Loops + Retries + Error Handling

SPECIALIZED AGENTS

[x] Feature 09 — Planner Agent
[x] Feature 10 — Researcher Agent
[x] Feature 11 — Architect Agent
[x] Feature 12 — Developer Agent
[x] Feature 13 — Tester Agent
[x] Feature 14 — Reviewer Agent
[x] Feature 15 — Security Agent

MULTI-AGENT ORCHESTRATION

[x] Feature 16 — Full Aegis Multi-Agent Workflow
[x] Feature 17 — Agent Routing + Conditional Execution
[x] Feature 18 — Failure Recovery + Iteration Loops

KNOWLEDGE + MEMORY

[x] Feature 19 — RAG Pipeline
[x] Feature 20 — Project Knowledge Retrieval
[x] Feature 21 — Short-Term Memory
[x] Feature 22 — Long-Term Memory

SAFETY + EXTERNAL SYSTEMS

[x] Feature 23 — Human-in-the-Loop
[x] Feature 24 — Tool Permissions / Guardrails
[x] Feature 25 — GitHub Integration
[x] Feature 26 — Repository Intelligence Engine
[x] Feature 27 — Aegis CLI Foundation

NOTE:

Older planning documents contained a conflicting/unused Feature 19
(Task Dependencies + Delegation) and Feature 23 (Procedural Skills)
entry.

The current historical implementation ledger above reflects the
feature sequence actually used by the project context.

Do not invent completion for skipped/unimplemented entries.


============================================================
63. CURRENT FEATURE STATUS
============================================================

Feature development is PAUSED.

The following are NOT currently "next features":

Feature 28 — Terminal / Sandbox Execution
Feature 29 — MCP Integration
Feature 30 — Session Runtime / Resume & Branching
Feature 31 — Observability & Token / Cost Tracking
Feature 32 — Agent Evaluation & Benchmarking
Feature 33 — Architecture Simplification Refactor

These are PAUSED / FUTURE WORK.

Resume them only when:

1. MVP validation demonstrates that they are required, OR
2. the project owner explicitly authorizes them.


============================================================
64. CURRENT MVP INTEGRATION STATUS
============================================================

The following status must be determined through the actual repository
audit.

Do NOT invent values.

| Capability | Implemented | Integrated | Validated |
|------------|-------------|------------|-----------|
| User task entry | UNKNOWN | UNKNOWN | UNKNOWN |
| Repository connection | UNKNOWN | UNKNOWN | UNKNOWN |
| Repository understanding | UNKNOWN | UNKNOWN | UNKNOWN |
| Repository intelligence | YES* | UNKNOWN | UNKNOWN |
| RAG pipeline | YES* | UNKNOWN | UNKNOWN |
| Project knowledge retrieval | YES* | UNKNOWN | UNKNOWN |
| Short-term memory | YES* | UNKNOWN | UNKNOWN |
| Long-term memory | YES* | UNKNOWN | UNKNOWN |
| Planner | YES* | UNKNOWN | UNKNOWN |
| Researcher | YES* | UNKNOWN | UNKNOWN |
| Architect | YES* | UNKNOWN | UNKNOWN |
| Developer | YES* | UNKNOWN | UNKNOWN |
| Tester | YES* | UNKNOWN | UNKNOWN |
| Reviewer | YES* | UNKNOWN | UNKNOWN |
| Security | YES* | UNKNOWN | UNKNOWN |
| Human approval | YES* | UNKNOWN | UNKNOWN |
| Tool permissions | YES* | UNKNOWN | UNKNOWN |
| GitHub integration | YES* | UNKNOWN | UNKNOWN |
| CLI foundation | YES* | UNKNOWN | UNKNOWN |
| Real file modification | UNKNOWN | UNKNOWN | UNKNOWN |
| Real test execution | UNKNOWN | UNKNOWN | UNKNOWN |
| Final verification | UNKNOWN | UNKNOWN | UNKNOWN |
| User-facing result | UNKNOWN | UNKNOWN | UNKNOWN |

*YES means historical implementation exists according to project
context. It does not mean current product-level integration is proven.

The repository audit must replace UNKNOWN with evidence-based status.


============================================================
65. REAL VS MOCK POLICY
============================================================

Production:

    REAL DATA
    REAL INTEGRATIONS
    REAL EXECUTION

Tests:

    CONTROLLED MOCKS ALLOWED

Demos:

    CLEARLY ISOLATED

Never:

    REAL INTEGRATION FAILS
        ↓
    FAKE SUCCESS

Never hide integration failures with silent fallbacks.


============================================================
66. GITHUB SAFETY MODEL
============================================================

Conceptually:

    READ
      ↓
    ANALYZE
      ↓
    PROPOSE
      ↓
    APPROVAL
      ↓
    WRITE
      ↓
    VERIFY

Read operations may generally be lower risk.

Write operations may require approval depending on policy.

High-risk operations should require explicit approval.

Examples:

- force push
- branch deletion
- protected branch merge
- workflow modification
- destructive repository operations


============================================================
67. SECRETS
============================================================

Secrets and tokens must remain server-side.

Never:

- expose GitHub tokens to frontend
- commit secrets
- print secrets into logs
- include secrets in agent context unnecessarily
- return secrets in tool output

Sensitive values must be scrubbed from diagnostics where appropriate.


============================================================
68. GIT / PR
============================================================

Use conventional commits where appropriate:

    feat:
    fix:
    refactor:
    test:
    docs:
    chore:

Feature-level commits should generally be:

    feat: <feature>

PR structure:

    ## Summary

    ## Changes

    ## Architecture

    ## Existing Functionality Preserved

    ## Verification

    ## Out of Scope

For capability-level changes also include:

    ## Integration

    - runtime consumer
    - integration boundary
    - evidence of actual usage


============================================================
69. DOCUMENTATION RULE
============================================================

Do not create documentation merely to create documentation.

Before creating a new document:

1. Check whether an existing document already owns that responsibility.
2. Prefer updating the existing document.
3. Avoid duplicate sources of truth.
4. Keep project documentation understandable.

Important project documents should have clearly separated roles.

This file:

    engineering context + development rules + current milestone

Architecture.md:

    technical architecture

Agent_Flow.md:

    intended workflow/agent flow

Build_plan.md:

    milestone/build planning

Must_build.md:

    priorities and acceptance requirements

Next_builds.md:

    paused/future work

Directory-architecture.md:

    workspace structure

PR.md:

    PR/verification template

README.md:

    user-facing project description


============================================================
70. INTENDED ARCHITECTURE VS ACTUAL STATE
============================================================

Architecture documentation describes intended organization.

Actual source code determines what currently exists.

When they disagree:

    DO NOT silently assume the documentation is correct.

Instead:

    inspect source
    ↓
    identify discrepancy
    ↓
    report
    ↓
    correct documentation or implementation intentionally


============================================================
71. ARCHITECTURE SIMPLIFICATION
============================================================

Architecture simplification is a separate engineering phase.

It begins only after the MVP workflow has been successfully validated.

The refactor should audit:

- file count
- directory depth
- module responsibilities
- duplicated logic
- duplicate types
- dead code
- stub code
- demo code
- unnecessary wrappers
- barrel files
- excessive agent fragmentation
- graph fragmentation
- service fragmentation

Target:

    simpler
    clearer
    fewer unnecessary moving parts

Not:

    rewrite everything


============================================================
72. FUTURE PRODUCT DIRECTION
============================================================

After MVP, AEGIS may evolve toward:

LEVEL 1 — CORE MVP

    Understand
    Investigate
    Plan
    Approve
    Implement
    Test
    Review
    Security
    Verify

LEVEL 2 — ENGINEERING INTELLIGENCE

    Repository indexing
    Symbol intelligence
    Relationship graph
    Dependency graph
    API graph
    Database relationships
    Git history
    Impact analysis
    Codebase-aware RAG

LEVEL 3 — ENGINEERING EXECUTION

    Branches
    Commits
    Pull requests
    CI diagnosis
    PR review
    Controlled GitHub actions

LEVEL 4 — DEVELOPER EXPERIENCE

    Strong CLI
    Web workspace
    Streaming
    Sessions
    Resume
    Context management
    User steering

LEVEL 5 — INTELLIGENCE / QUALITY

    Persistent memory
    Skills
    Evaluation
    Observability
    Architecture drift detection

LEVEL 6 — AUTOMATION

    Issue
      ↓
    Understand
      ↓
    Investigate
      ↓
    Plan
      ↓
    Implement
      ↓
    Test
      ↓
    Review
      ↓
    PR
      ↓
    CI
      ↓
    Fix
      ↓
    Verify

This roadmap is directional.

It must not override the current MVP milestone.


============================================================
73. USER STEERING
============================================================

Long-running AEGIS execution should eventually allow users to modify
constraints while work is in progress.

Example:

    AEGIS:
    Investigating database changes...

    USER:
    "Don't modify the database. Use an application-level solution."

AEGIS should adapt its plan where technically possible.

This is future capability unless required by MVP.


============================================================
74. PARALLEL AGENTS
============================================================

Parallel execution may be used when it genuinely improves performance
or reasoning.

Example:

    Research
       ├── API investigation
       ├── database investigation
       └── test investigation

Then:

    merge findings
        ↓
    continue workflow

Do not parallelize merely to make the system appear more agentic.


============================================================
75. MULTI-PROVIDER SUPPORT
============================================================

Multiple LLM providers may eventually be supported.

Do not create a large provider abstraction prematurely.

Current model priority:

    Gemini

Correctness and understandable architecture are more important than
premature provider flexibility.


============================================================
76. PROJECT OWNER LEARNING GOAL
============================================================

AEGIS is being built to help its owner understand:

- LLMs
- tool calling
- agents
- LangChain
- LangGraph
- RAG
- memory
- state machines
- orchestration
- human-in-the-loop
- repository intelligence
- GitHub APIs
- backend systems
- execution systems
- evaluation
- observability

Important engineering logic should remain understandable.

When explaining significant changes, prefer:

    mental model
        ↓
    data flow
        ↓
    implementation
        ↓
    verification


============================================================
77. CODING-AGENT PROMPT RULES
============================================================

Prompts should be:

- precise
- scoped
- actionable
- architecture-aware
- non-destructive
- verification-oriented

Every implementation prompt should generally contain:

    Read AGENT_BUILD_CONTEXT.md first.

    Inspect existing implementation before modifying.

    Identify the current state.

    Implement only the requested change.

    Preserve existing functionality.

    Reuse existing infrastructure.

    Do not overengineer.

    Do not implement future features prematurely.

    Verify the change.

    Report files modified and evidence.

Do not repeat the entire architecture in every prompt when this file
already contains it.


============================================================
78. WHEN A TASK IS LARGE
============================================================

Do not automatically use one giant implementation prompt.

For significant work, prefer:

    INSPECT
      ↓
    PLAN
      ↓
    IMPLEMENT
      ↓
    VERIFY

Use checkpoints between stages.

This is especially important for:

- architecture changes
- integration work
- workflow changes
- repository intelligence
- execution systems
- refactors


============================================================
79. WHAT AI MUST NOT DO
============================================================

AI coding agents must not:

- invent current implementation state
- claim integration without evidence
- claim runtime verification without actually running it
- fabricate GitHub data
- fabricate test results
- silently create duplicate systems
- rewrite unrelated working code
- implement future features without authorization
- mark isolated demos as product integration
- hide failures
- simplify architecture prematurely
- delete functionality merely because it is inconvenient
- create unnecessary documentation
- create unnecessary abstractions


============================================================
80. ABSOLUTE DEVELOPMENT RULES
============================================================

These rules are locked unless the project owner explicitly changes them.

1. AEGIS is an AI Engineering Operating System.

2. AEGIS is not a generic coding harness.

3. Do not clone Coding Harness/Athena/Hermes/Claude Code/OpenHands.

4. Learn concepts from other systems without copying their architecture.

5. Real integrations must use real data.

6. Never fake production GitHub data.

7. Never silently fall back to fake data.

8. Keep secrets server-side.

9. Web/API/CLI should share the AEGIS core.

10. LangGraph is the orchestration layer.

11. Agents have clear engineering responsibilities.

12. Engineering intent drives workflow/tool/agent selection.

13. Repository understanding is a core capability.

14. RAG should become codebase-aware and relationship-aware.

15. Repository relationships are more important than simple file retrieval.

16. Explain meaningful changes before execution.

17. Risky/destructive actions require appropriate human approval.

18. Execution must be verifiable.

19. Detect unintended changes.

20. Preserve working functionality.

21. Inspect before modifying.

22. Do not duplicate existing infrastructure.

23. Do not overengineer.

24. TypeScript-first.

25. Prefer simple, explicit, understandable architecture.

26. Do not implement future features prematurely.

27. Do not confuse implementation with integration.

28. Do not confuse integration with validation.

29. Unit tests do not automatically prove end-to-end behavior.

30. Real workflow evidence is required for product-level completion.

31. Feature development is frozen during MVP validation.

32. Existing capabilities must be integrated before unrelated new
    capabilities are added.

33. Architecture simplification happens after MVP validation.

34. Production uses real integrations; mocks are isolated to tests.

35. Failures must be explicit.

36. A successful tool call does not automatically mean task success.

37. The repository/source code is the implementation source of truth.

38. The project owner must understand important system behavior.

39. AEGIS should optimize for engineering usefulness, not feature count.

40. Do not declare MVP complete until a real engineering task has been
    successfully completed and verified through the real AEGIS runtime.


============================================================
81. CURRENT OPERATING MODE
============================================================

CURRENT MODE:

    MVP INTEGRATION + VALIDATION

CURRENT PRIORITY:

    Make the existing AEGIS pieces work together.

NOT CURRENT PRIORITY:

    Add more features.

Immediate sequence:

    1. Documentation/control reset
    2. Read-only repository/runtime audit
    3. Integration-gap map
    4. Integrate existing capabilities
    5. Real end-to-end engineering task
    6. Fix failures
    7. Repeat until MVP is genuinely usable
    8. Architecture simplification
    9. Resume roadmap

Until then:

    NO FEATURE 28
    NO FEATURE 29
    NO FEATURE 30
    NO FEATURE 31
    NO FEATURE 32
    NO FEATURE 33

unless explicitly required for MVP or explicitly authorized.


============================================================
82. FINAL PRODUCT IDENTITY
============================================================

Remember AEGIS as:

    AI ENGINEERING OPERATING SYSTEM

The user says:

    "I need this engineering change."

AEGIS should eventually:

    Understand the repository
        ↓
    Understand the engineering intent
        ↓
    Investigate
        ↓
    Build an engineering model
        ↓
    Plan
        ↓
    Explain
        ↓
    Obtain approval
        ↓
    Execute
        ↓
    Test
        ↓
    Review
        ↓
    Security-check
        ↓
    Verify
        ↓
    Report evidence

The core identity is:

    Repository Understanding
            +
    Engineering Intent
            +
    Multi-Agent Reasoning
            +
    Controlled Execution
            +
    Verification

AEGIS is not merely an AI that writes code.

AEGIS is an engineering system that understands software, reasons about
changes, orchestrates engineering work, executes approved actions, and
verifies the result.


============================================================
83. CURRENT NEXT ACTION
============================================================

DO NOT IMPLEMENT ANOTHER FEATURE.

The next action is:

    READ-ONLY AUDIT OF THE CURRENT AEGIS RUNTIME.

The audit must determine:

    What actually happens when a user submits an engineering task?

Trace:

    USER
      ↓
    ENTRY POINT
      ↓
    TASK
      ↓
    STATE
      ↓
    WORKFLOW
      ↓
    REPOSITORY UNDERSTANDING
      ↓
    AGENTS
      ↓
    TOOLS
      ↓
    APPROVAL
      ↓
    FILE CHANGES
      ↓
    TESTS
      ↓
    REVIEW
      ↓
    SECURITY
      ↓
    VERIFICATION
      ↓
    RESULT

The audit must be read-only.

Do not refactor.

Do not simplify.

Do not add features.

Do not delete files.

Do not "fix" anything during the initial audit.

Produce an evidence-based integration-gap map.

After the audit, implementation will proceed one integration gap at a
time.


============================================================
END OF AEGIS AGENT BUILD CONTEXT
============================================================