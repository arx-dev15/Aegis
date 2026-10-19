# AEGIS Implementation Plan

## 1. Purpose

This document defines how AEGIS work is implemented after the current product direction has been established.

It is an execution document, not a feature inventory.

The current objective is to make the existing AEGIS components work together as one real engineering system.

---

# 2. Current Development Phase

```text
MVP Integration + Validation

Current priority:

Inspect
 ↓
Understand
 ↓
Identify Gaps
 ↓
Fix Integration
 ↓
Run Real Task
 ↓
Verify

Do not continue adding major features until the MVP workflow has been validated.

3. Source of Truth

Implementation decisions must follow this priority:

1. Actual Repository Code
2. Runtime Behavior
3. Tests / Concrete Evidence
4. Current Project Documentation
5. Conversation Context
6. Assumptions

If documentation and implementation disagree:

The implementation is the current truth.

The discrepancy must be identified rather than silently ignored.

4. Implementation Rules

Every change should follow these rules:

Inspect before modifying.
Reuse existing infrastructure where appropriate.
Make the smallest reasonable change.
Preserve working functionality.
Avoid unnecessary abstractions.
Avoid duplicate systems.
Avoid unnecessary dependencies.
Avoid unnecessary files.
Keep data flow explicit.
Keep functions understandable.
Do not silently change unrelated behavior.
Do not fabricate integrations.
Do not hide failures.
Verify changes with concrete evidence.
5. Standard Feature Workflow

For any future feature:

Requirement
    ↓
Inspect Existing Implementation
    ↓
Identify Gap
    ↓
Plan Smallest Change
    ↓
Implement
    ↓
Run Tests
    ↓
Inspect Result
    ↓
Validate Integration
    ↓
Update Documentation

A feature is not considered complete merely because its code exists.

6. Current MVP Workflow

The current implementation work must focus on this path:

Real User
    ↓
Real Entry Point
    ↓
Real Task
    ↓
Real Repository
    ↓
Repository Context
    ↓
Investigation
    ↓
Plan
    ↓
Approval
    ↓
Implementation
    ↓
Real File Changes
    ↓
Real Tests
    ↓
Review
    ↓
Security
    ↓
Verification
    ↓
Result + Evidence

Every stage must be traced to the actual implementation.

7. Phase 1 — Read-Only Runtime Audit
Objective

Determine how the current system actually executes.

Inspect
Entry Points

Find:

Web entry points
API entry points
CLI entry points
workflow entry points
graph construction
graph execution
Workflow

Trace:

Entry
 ↓
Task
 ↓
State
 ↓
Graph
 ↓
Nodes
 ↓
Agents
 ↓
Tools
 ↓
Result
Agents

Determine:

which agents exist
which are actually instantiated
which are actually invoked
what state they receive
what they return
where their output goes
Tools

Determine:

which tools exist
which are actually registered
which agents can invoke them
whether they operate on real data
how failures are handled
Repository Intelligence

Determine:

how repositories are loaded
how files are discovered
how relationships are represented
how context is retrieved
how agents consume the context
Testing

Determine:

how tests are discovered
how tests are executed
how failures enter workflow state
whether test results influence routing
Approval

Determine:

what actions require approval
where approval is checked
whether execution actually waits for approval
Verification

Determine:

how final success is determined
what evidence is collected
whether repository state is actually checked
Output

Create an integration-gap map:

Component
Status
Actual Entry Point
Actual Consumer
Actual Output
Evidence
Gap

Possible statuses:

COMPLETE
INTEGRATED
IMPLEMENTED
PARTIAL
STUB
BROKEN
UNUSED
UNKNOWN
8. Phase 2 — Integration Fixes

Only fix gaps that prevent the MVP workflow from working.

Examples:

Agent exists
but graph never invokes it
        ↓
Integrate agent into actual route
Tool exists
but Developer cannot invoke it
        ↓
Connect tool through existing tool system
Test runner works
but result never reaches graph state
        ↓
Connect result to workflow state
Approval exists
but execution continues without approval
        ↓
Fix approval gate

Do not rewrite working components unnecessarily.

9. Phase 3 — Real Repository Test

Select a real repository.

Run AEGIS against it.

Verify:

Repository Discovery
        ↓
Relevant Context
        ↓
Task Understanding
        ↓
Plan
        ↓
Implementation
        ↓
Actual File Changes
        ↓
Git Diff
        ↓
Tests

Evidence should come from the actual repository.

10. Phase 4 — Real Engineering Task

Use one small but meaningful engineering task.

Example:

Add GET /users/:id and appropriate tests.

or:

Fix a failing API test.

The task should require enough repository understanding to exercise AEGIS meaningfully.

Do not choose an artificial task that bypasses the real workflow.

11. Phase 5 — Failure Recovery

Introduce or encounter a realistic implementation failure.

Expected flow:

Developer
    ↓
Tester
    ↓
Failure
    ↓
Failure Context
    ↓
Recovery Decision
    ↓
Developer
    ↓
Tester
    ↓
Verification

Verify that:

failure output is preserved
relevant context is preserved
the correct recovery stage is selected
the entire workflow is not blindly restarted
the final result reflects the recovery
12. Phase 6 — MVP Verification

MVP verification must cover four levels.

Structural

Does the required implementation exist?

Build

Does the project compile/build successfully?

Runtime

Does the actual execution path work?

Integration / E2E

Can AEGIS complete a real engineering task?

The fourth level is the most important.

13. Definition of Done

A change is complete only when:

Implementation
    +
Integration
    +
Tests
    +
Runtime Evidence

For MVP:

Real Task
    +
Real Repository
    +
Real File Changes
    +
Real Tests
    +
Review
    +
Security
    +
Verification
    +
Evidence
14. Documentation Updates

Documentation should be updated after behavior is verified.

Do not update documentation first merely to make the system appear complete.

Documentation should distinguish:

Implemented
Integrated
Validated
Planned
Unknown

Documentation must not claim runtime behavior that has not been verified.

15. Architecture Simplification

Architecture simplification is a separate phase.

Do not mix it into normal feature implementation.

It begins only after MVP validation.

The process will be:

Repository Audit
 ↓
Dependency / Responsibility Map
 ↓
Identify Duplication
 ↓
Identify Dead / Stub Code
 ↓
Identify Unnecessary Abstractions
 ↓
Design Simpler Architecture
 ↓
Incremental Refactor
 ↓
Regression Tests
 ↓
Verification

The objective is:

Preserve or improve capability while reducing unnecessary complexity.

16. Future Feature Development

After MVP validation, future features should be implemented one at a time.

Before starting a feature:

1. Requirement

What exact engineering problem does it solve?

2. Existing System

What already exists that can be reused?

3. Gap

What is actually missing?

4. Smallest Change

What is the minimum implementation required?

5. Integration

Where does the feature enter the real workflow?

6. Verification

How will we prove it works?

If these cannot be answered clearly, implementation should not begin.

17. Anti-Patterns

Do not:

Build feature
 ↓
Write tests
 ↓
Declare complete

without validating integration.

Do not:

create a new system when an existing one can be reused
create duplicate agent/tool abstractions
add files solely to make architecture look cleaner
add fake integrations
hardcode demo data into production paths
hide errors with fallbacks
bypass approval
mark features complete based only on unit tests
continue feature numbering without validating the product
18. Current Execution Rule

Until MVP validation succeeds:

NO MAJOR FEATURE EXPANSION

Work only on:

Audit
 ↓
Integration
 ↓
Real Task
 ↓
Failure Recovery
 ↓
Verification

After MVP success, begin architecture simplification before resuming broader feature development.

19. Final Principle

The objective of implementation is not:

More agents + more tools + more files + more tests.

The objective is:

AEGIS can take a real engineering task, understand a real repository, make an approved change, test it, review it, verify it, and provide evidence that the task was completed.