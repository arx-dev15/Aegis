# AEGIS — BUILD PLAN

This document defines the current development sequence for AEGIS.

It is intentionally NOT a feature-by-feature roadmap.

The current objective is to make the existing AEGIS capabilities operate
as one real engineering system before adding further capabilities.

Read `AGENT_BUILD_CONTEXT.md` and `Must_build.md` before using this plan.


============================================================
PHASE 0 — DOCUMENTATION / DEVELOPMENT CONTROL RESET
============================================================

STATUS: COMPLETE

Objective:

Establish a single, consistent development model for AEGIS.

Completed:

- `AGENT_BUILD_CONTEXT.md` updated.
- `Must_build.md` updated.
- Feature-count-driven development is paused.
- MVP-first development is now the active development model.
- Implemented / Integrated / Validated / Complete are explicitly
  distinguished.


============================================================
PHASE 1 — READ-ONLY SYSTEM AUDIT
============================================================

STATUS: NEXT

Objective:

Understand what the current AEGIS runtime actually does.

IMPORTANT:

This phase is READ-ONLY.

Do NOT:

- refactor
- simplify architecture
- delete files
- add features
- rewrite workflows
- change agents
- change UI
- change APIs

The purpose is to discover reality before changing it.

Audit the actual runtime path:

```text
USER
 ↓
ENTRY POINT
 ↓
TASK CREATION
 ↓
AEGIS STATE
 ↓
WORKFLOW / GRAPH
 ↓
REPOSITORY UNDERSTANDING
 ↓
AGENTS
 ↓
TOOLS
 ↓
APPROVAL
 ↓
IMPLEMENTATION
 ↓
TESTING
 ↓
REVIEW
 ↓
SECURITY
 ↓
VERIFICATION
 ↓
RESULT

Determine for every stage:

where it is implemented
what invokes it
what data enters it
what it produces
who consumes its output
whether it is actually reachable
whether it is real or mocked
whether it is integrated
whether it is only an isolated implementation

Required output:

A. Runtime Entry Point

Identify the actual user-facing entry point currently used by AEGIS.

B. Actual Workflow

Trace the real execution path from user task to final result.

C. Integration Map

Identify:

connected components
disconnected components
duplicate paths
dead paths
demo paths
mock paths
missing state transitions
missing data flow
missing verification
D. Capability Status

Classify relevant components as:

NOT IMPLEMENTED
STUB
IMPLEMENTED
INTEGRATED
VALIDATED
BROKEN
UNUSED
E. Critical Gaps

Identify the smallest set of problems preventing the MVP from working.

Do not fix them during this phase.

============================================================
PHASE 2 — MVP CORE WORKFLOW INTEGRATION

STATUS: BLOCKED UNTIL PHASE 1

Objective:

Connect the existing components into the actual AEGIS engineering
workflow.

Target:

USER TASK
 ↓
REPOSITORY CONTEXT
 ↓
INVESTIGATION
 ↓
PLAN
 ↓
APPROVAL
 ↓
IMPLEMENT
 ↓
TEST
 ↓
REVIEW
 ↓
SECURITY
 ↓
VERIFY
 ↓
RESULT

Priority:

Fix actual runtime entry.
Fix task/state flow.
Connect repository context.
Connect investigation.
Connect planning.
Connect approval.
Connect implementation.
Connect test execution.
Connect review.
Connect security.
Connect final verification.
Connect user-facing result.

Use existing implementations wherever possible.

Do NOT build replacement systems unless the existing implementation
cannot support the required workflow.

============================================================
PHASE 3 — REAL REPOSITORY VALIDATION

STATUS: BLOCKED UNTIL PHASE 2

Objective:

Prove that AEGIS can work against a real repository.

Validation must use:

real repository
real source files
real repository structure
real engineering task

Validate:

repository inspection
relevant-file discovery
repository context
dependency/relationship understanding
agent reasoning
actual implementation

No fake repository data.

============================================================
PHASE 4 — REAL ENGINEERING TASK

STATUS: BLOCKED UNTIL PHASE 3

Objective:

Run the complete AEGIS workflow against a realistic engineering task.

Example:

Add GET /users/:id and appropriate tests.

Expected:

User
 ↓
Task
 ↓
Repository Understanding
 ↓
Investigation
 ↓
Plan
 ↓
Approval
 ↓
Implementation
 ↓
Tests
 ↓
Review
 ↓
Security
 ↓
Verification
 ↓
Result

The task must use the actual AEGIS runtime.

Do NOT create a special demo workflow for this validation.

============================================================
PHASE 5 — FAILURE / RECOVERY VALIDATION

STATUS: BLOCKED UNTIL PHASE 4

Objective:

Prove that AEGIS can handle realistic engineering failure.

Example:

Implementation
 ↓
Tests fail
 ↓
Failure captured
 ↓
Relevant context preserved
 ↓
Workflow routes to appropriate recovery stage
 ↓
Fix
 ↓
Tests
 ↓
Verification

Validate:

tool failures
test failures
agent failures
invalid output
retry behavior
contextual recovery
final failure reporting

Do not blindly restart the entire workflow.

============================================================
PHASE 6 — MVP ACCEPTANCE

STATUS: BLOCKED UNTIL PHASE 5

Objective:

Determine whether AEGIS actually satisfies the MVP.

MVP acceptance requires:

[ ] Real user task

[ ] Real repository

[ ] Real repository understanding

[ ] Real investigation

[ ] Real plan

[ ] Real approval where required

[ ] Real file modification

[ ] Real tests

[ ] Real review

[ ] Relevant security validation

[ ] Real final verification

[ ] Useful final result

[ ] Evidence of execution

[ ] At least one successful real engineering task

[ ] At least one realistic failure/recovery scenario

If any critical requirement fails:

MVP IS NOT COMPLETE.

Return to the responsible phase and fix the smallest responsible
component.

============================================================
PHASE 7 — ARCHITECTURE SIMPLIFICATION

STATUS: DEFERRED

This phase begins ONLY after MVP validation.

Objective:

Simplify the working system without reducing functionality.

Audit:

file count
folder depth
duplicate modules
duplicate types
duplicate services
unnecessary wrappers
unnecessary abstractions
dead code
demo code
stub code
fragmented agent modules
fragmented graph modules
unnecessary barrel files

Target:

Same capabilities
+
Clearer flow
+
Fewer unnecessary moving parts

Do NOT:

rewrite everything
refactor working code for aesthetics
remove functionality
change behavior unnecessarily

Every refactor must be followed by regression verification.

============================================================
PHASE 8 — PRODUCT HARDENING

STATUS: FUTURE

After MVP and architecture simplification:

Potential work:

stronger repository intelligence
relationship-aware RAG
change impact analysis
stronger CLI
sessions
resume/branching
context management
observability
evaluation
reusable engineering skills
GitHub execution
CI integration
PR automation
architecture drift detection
============================================================
PHASE 9 — ADVANCED AUTOMATION

STATUS: FUTURE

Long-term target:

Issue / Engineering Task
 ↓
Understand
 ↓
Investigate
 ↓
Plan
 ↓
Approve
 ↓
Implement
 ↓
Test
 ↓
Review
 ↓
Security
 ↓
PR
 ↓
CI
 ↓
Fix
 ↓
Verify

This phase must only be pursued after the core engineering workflow is
stable.

============================================================
CURRENT DEVELOPMENT STATE

CURRENT PHASE:

PHASE 1 — READ-ONLY SYSTEM AUDIT

CURRENT OBJECTIVE:

Determine what AEGIS ACTUALLY does today.

CURRENT RULE:

DO NOT IMPLEMENT NEW FEATURES.

NEXT ACTION:

Perform the read-only runtime audit.

Trace the real execution path and produce the integration-gap map.

============================================================
ROADMAP RULE

Historical feature numbers remain useful for tracking what has already
been built.

They do NOT determine what gets built next.

The next task is determined by:

CURRENT MVP GAP

not:

NEXT FEATURE NUMBER
============================================================
DEFINITION OF PROGRESS

Progress is measured by:

Working product capability

not:

Number of files

not:

Number of agents

not:

Number of features

not:

Number of tests

not:

Number of integrations implemented in isolation
============================================================
END OF BUILD PLAN
