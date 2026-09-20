# AEGIS Agent Flow

## 1. Purpose

This document defines how AEGIS agents are intended to participate in the engineering workflow.

The purpose is not to describe isolated agents.

The goal is to define how agents cooperate to complete a real engineering task.

The actual runtime implementation must be verified against the repository.

---

# 2. Core Engineering Flow

The intended flow is:

```text
User Task
    ↓
Repository Understanding
    ↓
Investigation
    ↓
Planning
    ↓
Architecture
    ↓
Human Approval
    ↓
Implementation
    ↓
Testing
    ↓
Review
    ↓
Security
    ↓
Verification
    ↓
Result + Evidence
```

Not every task necessarily requires every stage.

The workflow should route based on the actual task and current state.

---

# 3. Agent Responsibilities

## Planner

Responsible for converting the user's engineering request into a concrete plan.

Input:

- user task
- repository context
- relevant investigation results

Output:

- understood requirement
- affected areas
- implementation steps
- expected verification

The Planner should not implement code.

---

## Researcher

Responsible for investigating the repository and gathering relevant technical context.

It may inspect:

- files
- symbols
- imports
- APIs
- tests
- dependencies
- Git history
- repository relationships
- external technical information when required

Output should provide evidence useful to downstream agents.

The Researcher should avoid retrieving large amounts of irrelevant context.

---

## Architect

Responsible for deciding how the requested change should fit into the existing system.

It should consider:

- existing architecture
- affected components
- dependencies
- data flow
- APIs
- database implications
- failure cases
- testing implications

The Architect should prefer the smallest reasonable change.

It should not redesign the system unnecessarily.

---

## Developer

Responsible for implementing an approved engineering change.

The Developer may use controlled tools such as:

- filesystem
- terminal
- Git
- repository tools
- database tools
- other approved capabilities

The Developer must work from repository evidence and the approved plan.

It should not silently introduce unrelated changes.

---

## Tester

Responsible for validating the implementation.

The Tester should:

- identify relevant tests
- execute tests
- capture failures
- interpret failures
- provide evidence

A successful command is not automatically proof that the feature works.

---

## Reviewer

Responsible for reviewing the resulting implementation.

The Reviewer should examine:

- correctness
- maintainability
- unintended changes
- adherence to the plan
- integration with existing code
- test coverage
- obvious regressions

The Reviewer should review the actual changes, not only the agent's explanation.

---

## Security

Responsible for identifying security risks relevant to the task and implementation.

Depending on the task, this may include:

- authentication/authorization
- input validation
- secrets
- command execution
- filesystem access
- injection risks
- unsafe external operations
- dependency concerns
- data exposure

Security checks should be proportional to the task.

---

# 4. Agent Relationship

Agents should form an engineering pipeline rather than independent chatbots.

Conceptually:

```text
Planner
   ↓
Researcher
   ↓
Architect
   ↓
Approval
   ↓
Developer
   ↓
Tester
   ↓
Reviewer
   ↓
Security
   ↓
Verification
```

However, this sequence is not necessarily rigid.

The graph should route according to workflow state.

For example:

```text
Test Failure
    ↓
Failure Analysis
    ↓
Developer
    ↓
Tester
```

rather than restarting the entire workflow.

---

# 5. Shared Workflow State

Agents should communicate through explicit workflow state.

Conceptually, state may contain:

```text
Task
Repository
Repository Context
Investigation
Plan
Architecture Decision
Approval
Implementation Changes
Test Results
Review Findings
Security Findings
Failures
Recovery Context
Verification
Final Evidence
```

The exact state structure must be based on the current implementation.

Do not duplicate the same information across multiple independent state systems.

---

# 6. Repository Context

Repository context is a shared foundation for engineering agents.

The intended relationship is:

```text
Repository
    ↓
Repository Intelligence
    ↓
Relevant Context
    ↓
Agents
```

Agents should receive task-relevant repository information rather than independently rebuilding the same understanding.

Repository context should eventually include relationships such as:

```text
File
 ↓
Symbol
 ↓
Import
 ↓
API
 ↓
Database
 ↓
Test
 ↓
Dependency
```

The maturity of this capability must be verified through the repository audit.

---

# 7. Tool Usage

Agents do not directly own arbitrary system capabilities.

They use controlled tools.

Conceptually:

```text
Agent
  ↓
Tool Request
  ↓
Policy / Validation
  ↓
Tool Execution
  ↓
Tool Result
  ↓
Workflow State
```

Examples:

```text
Developer → Filesystem
Developer → Terminal
Researcher → Search
Researcher → GitHub
Tester → Terminal
Security → Repository / Search
```

Tool usage must be observable and failures must be preserved.

---

# 8. Approval Flow

Approval is required for meaningful risky or destructive actions.

Conceptually:

```text
Agent
  ↓
Action Request
  ↓
Risk Check
  ↓
Approval Required?
  ├── No ───────→ Continue
  │
  └── Yes
        ↓
      Human
        ├── Approve → Execute
        └── Reject  → Stop / Return
```

Approval must happen before the risky action.

The system must not simulate approval merely to continue execution.

---

# 9. Implementation Flow

The intended implementation flow is:

```text
Approved Plan
    ↓
Developer
    ↓
Inspect Relevant Code
    ↓
Modify Repository
    ↓
Capture Changes
    ↓
Tester
```

Implementation should be incremental.

The Developer should preserve unrelated working functionality.

---

# 10. Test Failure and Recovery

Failures are expected parts of engineering work.

The intended recovery flow is:

```text
Implementation
    ↓
Testing
    ↓
Tests Fail
    ↓
Failure Captured
    ↓
Failure Context Analyzed
    ↓
Relevant Recovery Stage
    ↓
Developer
    ↓
Testing
```

The workflow should preserve:

- failing test
- error output
- relevant files
- previous implementation context
- attempted fix
- recovery history

A test failure should not automatically restart the entire workflow.

---

# 11. Review Flow

After implementation and testing:

```text
Implementation
    ↓
Tests
    ↓
Review
    ↓
Security
    ↓
Verification
```

Review should inspect the actual repository state and changes.

Review findings may cause the workflow to return to implementation.

Example:

```text
Reviewer
   ↓
Issue Found
   ↓
Developer
   ↓
Tester
   ↓
Reviewer
```

---

# 12. Security Flow

Security should operate as an engineering stage, not as a disconnected report generator.

Conceptually:

```text
Implementation
    ↓
Security Analysis
    ↓
Findings?
 ├── No → Verification
 │
 └── Yes
       ↓
    Developer
       ↓
     Tester
       ↓
    Security
```

The exact routing should depend on the severity and relevance of the finding.

---

# 13. Verification

Verification is the final engineering check.

It should answer:

> Did AEGIS actually accomplish the requested task?

Verification should consider:

- requested behavior
- repository changes
- test results
- review findings
- security findings
- expected final state

The final result should contain evidence rather than only an LLM-generated claim.

---

# 14. Final Result

The user-facing result should communicate:

```text
Task
 ↓
What Changed
 ↓
Tests
 ↓
Review
 ↓
Security
 ↓
Verification
 ↓
Evidence
```

The result should distinguish between:

- completed
- partially completed
- failed
- blocked
- requires user action

AEGIS should never report successful completion solely because an agent finished its response.

---

# 15. Dynamic Routing

The graph should route based on state.

Examples:

```text
Task
 ↓
Needs Research?
 ├── Yes → Researcher
 └── No
      ↓
Needs Architecture?
 ├── Yes → Architect
 └── No
      ↓
Approval Required?
 ├── Yes → Approval
 └── No
      ↓
Developer
```

Similarly:

```text
Tests
 ↓
Passed?
 ├── Yes → Review
 └── No  → Recovery
```

And:

```text
Review
 ↓
Issues?
 ├── No → Security
 └── Yes → Developer
```

Routing decisions should be explicit and observable.

---

# 16. Agent Boundaries

Agents should remain specialized.

Avoid turning every operation into an agent.

Simple deterministic operations should remain tools, functions, or graph logic when appropriate.

Examples:

```text
Run command       → Tool
Read file         → Tool
Validate schema   → Function
Route graph       → Graph logic
Plan engineering  → Planner
Investigate repo  → Researcher
Implement change  → Developer
Review change     → Reviewer
```

This keeps AEGIS understandable and reduces unnecessary agent complexity.

---

# 17. Current Runtime Status

This document describes the intended agent flow.

The following must be verified during the Phase 1 system audit:

- actual workflow entry point
- actual graph execution path
- which agents are invoked
- how agents receive state
- how agents invoke tools
- how approval is enforced
- how failures are routed
- how test results reach the workflow
- how review/security affect routing
- how final verification is performed
- whether Web/API/CLI use the same core

Until verified, these should be treated as:

```text
UNKNOWN / VERIFICATION PENDING
```

Do not mark an agent as integrated merely because its implementation exists.

---

# 18. MVP Agent Flow

The minimum flow that must be proven with a real repository and real engineering task is:

```text
User
  ↓
Task Entry
  ↓
Repository Context
  ↓
Planner / Researcher
  ↓
Plan
  ↓
Approval
  ↓
Developer
  ↓
Real File Changes
  ↓
Tester
  ↓
Review
  ↓
Security
  ↓
Verification
  ↓
Result + Evidence
```

At least one realistic failure/recovery path must also be demonstrated:

```text
Developer
   ↓
Tester
   ↓
Failure
   ↓
Recovery
   ↓
Developer
   ↓
Tester
   ↓
Verification
```

This is the acceptance target for the current MVP phase.

---

# 19. Important Rule

Agent existence is not agent integration.

A passing unit test is not workflow validation.

A successful tool call is not task success.

An agent-generated explanation is not verification.

AEGIS is considered integrated only when the complete runtime path works on a real engineering task and produces verifiable repository changes and evidence.