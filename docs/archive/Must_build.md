# AEGIS — MUST BUILD

This document defines the product requirements and acceptance criteria
for AEGIS.

It is NOT a feature roadmap.

The current priority is to make the existing AEGIS capabilities work
together as one usable engineering system.

Read `AGENT_BUILD_CONTEXT.md` before using this document.


============================================================
1. CORE PRODUCT REQUIREMENT
============================================================

AEGIS must allow an engineer to provide:

    REAL REPOSITORY
    +
    REAL ENGINEERING TASK

and receive:

    INVESTIGATION
    →
    PLAN
    →
    APPROVAL
    →
    IMPLEMENTATION
    →
    TESTING
    →
    REVIEW
    →
    SECURITY CHECK
    →
    VERIFICATION
    →
    RESULT

The goal is not to maximize the number of agents or features.

The goal is to make this workflow actually work.


============================================================
2. MVP
============================================================

The AEGIS MVP is:

> Give AEGIS a real repository and a real engineering task. AEGIS
> understands the relevant repository context, investigates the task,
> produces a plan, executes the approved change, tests it, reviews it,
> and verifies the result.

MVP workflow:

```text
User
 ↓
Engineering Task
 ↓
Repository Understanding
 ↓
Investigation
 ↓
Plan
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
Final Verification
 ↓
Result + Evidence
============================================================
3. MVP MUST HAVE
3.1 Real Task Entry

A user must be able to submit an actual engineering task through a
real AEGIS entry point.

The entry point may be:

CLI
API
Web UI

but it must eventually reach the same AEGIS core runtime.

3.2 Real Repository

AEGIS must work against an actual repository.

The repository may be:

local
connected through GitHub

Repository information must come from the actual repository.

No fake repository data.

3.3 Repository Understanding

AEGIS must inspect enough of the repository to understand the task.

Depending on the task, this may include:

files
symbols
imports
APIs
database structures
tests
configuration
dependencies
GitHub information
relationships

Do not retrieve the entire repository unnecessarily.

3.4 Investigation

AEGIS must investigate before modifying code.

Investigation should identify:

relevant files
existing behavior
dependencies
affected components
relevant tests
potential risks

The investigation should produce evidence usable by later stages.

3.5 Planning

AEGIS must produce an actionable engineering plan.

The plan should identify:

goal
affected areas
required changes
dependencies
tests
risks
execution requirements
3.6 Human Approval

When the planned action requires meaningful or risky modification,
AEGIS must be able to pause and request approval.

The approval must affect the actual runtime.

A UI element that says "Approve" without controlling execution does
not satisfy this requirement.

3.7 Real Implementation

After approval, AEGIS must modify the actual repository.

Changes must:

affect the intended files
use existing project architecture
avoid unrelated modifications
be observable through the actual diff
3.8 Real Testing

AEGIS must run appropriate tests/checks against the actual change.

Examples:

unit tests
integration tests
type checking
build
API checks
repository-specific tests

The tester must report actual results.

3.9 Review

The resulting change must be reviewed.

Review should consider:

correctness
requirements
architecture
unintended changes
duplication
maintainability
regressions
3.10 Security

Security checks must run where relevant.

Examples:

secrets
authentication
authorization
injection
unsafe commands
filesystem operations
GitHub permissions
3.11 Final Verification

AEGIS must determine whether the requested engineering task was
actually completed.

Verification must compare:

USER REQUEST
    ↓
INTENDED CHANGE
    ↓
ACTUAL CHANGE
    ↓
TEST RESULTS
    ↓
FINAL STATE

A successful tool call does not equal successful task completion.

3.12 Evidence

The final result should provide useful evidence such as:

files inspected
files changed
tools used
tests executed
test results
review findings
security findings
final verification result
============================================================
4. MVP ACCEPTANCE TEST

MVP is considered successful only after AEGIS completes at least one
real engineering task through the real runtime.

Example:

"Add GET /users/:id and appropriate tests."

Expected:

User submits task
 ↓
AEGIS receives task
 ↓
Repository is inspected
 ↓
Relevant code is identified
 ↓
Plan is generated
 ↓
Approval occurs if required
 ↓
Real files are modified
 ↓
Real tests run
 ↓
Diff is reviewed
 ↓
Security is checked where relevant
 ↓
Final state is verified
 ↓
User receives result + evidence

This must NOT be achieved through a special demo script.

It must use the actual AEGIS product workflow.

============================================================
5. FAILURE ACCEPTANCE TEST

MVP must also demonstrate at least one realistic failure path.

Example:

Developer changes code
 ↓
Tests fail
 ↓
Failure is captured
 ↓
Relevant context is preserved
 ↓
Workflow routes back to the appropriate stage
 ↓
Developer receives failure information
 ↓
Fix is attempted
 ↓
Tests run again
 ↓
Final state is verified

The workflow must not blindly restart from the beginning.

============================================================
6. WHAT DOES NOT COUNT AS MVP COMPLETION

The following do NOT prove MVP completion:

TypeScript compilation
unit tests alone
agent tests alone
tool tests alone
RAG tests alone
GitHub API tests alone
repository intelligence tests alone
CLI command tests alone
demo scripts
hardcoded workflows
fake repository data
fake GitHub data
simulated tool results
successful individual agent execution
successful individual graph execution

These prove components.

MVP requires the components to work together.

============================================================
7. INTEGRATION REQUIREMENT

Every important existing capability must eventually answer:

Who uses it?

When is it used?

What data enters it?

What does it produce?

Who consumes that result?

How does it contribute to the MVP workflow?

If a capability has no meaningful consumer in the current product,
it should not be treated as a completed product capability.

============================================================
8. CURRENT PRIORITY

CURRENT:

MVP INTEGRATION + VALIDATION

Priority order:

Audit current runtime.
Find disconnected components.
Connect existing capabilities.
Fix broken data/state flow.
Fix incorrect routing.
Remove fake/demo production paths.
Connect real repository understanding.
Connect real agents.
Connect real tools.
Connect approval.
Connect real implementation.
Connect testing.
Connect review/security.
Connect final verification.
Run real engineering tasks.
Fix failures.
Repeat until MVP is reliable.
============================================================
9. FEATURE FREEZE

NO NEW ROADMAP FEATURES DURING MVP VALIDATION.

Do not implement:

Terminal/Sandbox as a standalone roadmap feature
MCP
Session Runtime
Observability
Evaluation
advanced CLI features
architecture simplification

unless the current MVP integration proves that the capability is
directly required.

Existing implementations may be repaired or integrated when required.

============================================================
10. PRODUCT COMPLETION STATES

Use these states:

NOT IMPLEMENTED

No meaningful implementation exists.

STUB

Structure exists but real behavior does not.

IMPLEMENTED

The capability exists and works in isolation.

INTEGRATED

The capability is connected to the actual AEGIS workflow.

VALIDATED

The integrated capability has been exercised successfully in a
realistic workflow.

COMPLETE

The capability is:

IMPLEMENTED
+
INTEGRATED
+
VALIDATED
============================================================
11. REAL DATA RULE

Production AEGIS must use real data.

Allowed:

Production → real integrations
Tests      → controlled mocks
Fixtures   → isolated test/demo environments

Not allowed:

Real integration fails
 ↓
Fake successful response

Never hide integration failures.

============================================================
12. ARCHITECTURE REQUIREMENT

The architecture must remain understandable.

Prefer:

simple modules
explicit data flow
shared core
clear agent responsibilities
reusable tools
simple state
minimal abstractions

Avoid:

unnecessary files
unnecessary folders
duplicate services
duplicate tools
duplicate types
excessive wrappers
unnecessary abstractions
premature optimization

Do not perform the major architecture simplification until MVP
validation succeeds.

============================================================
13. SHARED CORE

Web, API and CLI must ultimately use the same AEGIS core.

Web ──┐
API ──┼──→ AEGIS Core → Graph → Agents → Tools
CLI ──┘

Do not create separate implementations of the engineering workflow for
each interface.

============================================================
14. SAFETY

Meaningful risky actions require appropriate human approval.

Conceptually:

READ
 ↓
ANALYZE
 ↓
PLAN
 ↓
APPROVAL
 ↓
EXECUTE
 ↓
VERIFY

Never bypass approval simply to make the system appear autonomous.

============================================================
15. PRESERVE EXISTING FUNCTIONALITY

During MVP integration:

inspect before modifying
preserve working functionality
reuse existing infrastructure
modify the smallest necessary surface
do not rewrite unrelated systems
do not introduce duplicate implementations
============================================================
16. VERIFICATION REQUIREMENT

Important changes should be verified at the appropriate levels:

Structural

Does the expected connection/code exist?

Build

Does the project compile/build?

Runtime

Does the functionality actually execute?

Integration

Do the connected components actually exchange the expected data?

End-to-End

Does the real user workflow produce the expected engineering result?

============================================================
17. DEFINITION OF DONE

A product capability is DONE only when:

[ ] Requirement is clear.

[ ] Existing implementation was inspected.

[ ] Required code exists.

[ ] Real workflow consumes it.

[ ] Data flows correctly.

[ ] Real runtime execution succeeds.

[ ] Appropriate tests pass.

[ ] Failure behavior is handled.

[ ] No fake production fallback exists.

[ ] No unrelated functionality was broken.

[ ] Evidence exists.

[ ] The capability is marked with the correct maturity state.

============================================================
18. FUTURE FEATURES

Future capabilities remain valuable but are NOT current priorities.

Potential future work:

Terminal / Sandbox
MCP
persistent sessions
resume/branching
advanced context management
observability
evaluation
skills
advanced CLI
CI automation
PR automation
architecture drift detection
architecture simplification

They must not distract from the MVP.

============================================================
19. MVP SUCCESS CONDITION

The current phase ends only when the following statement is true:

A developer can give AEGIS a real engineering task against a real
repository, and AEGIS can investigate it, plan it, obtain approval
where required, make the real change, test it, review it, verify it,
and return an evidence-backed result through the real AEGIS runtime.

============================================================
20. CURRENT INSTRUCTION

DO NOT BUILD THE NEXT FEATURE.

FIRST:

AUDIT
→
IDENTIFY INTEGRATION GAPS
→
FIX
→
RUN REAL TASK
→
VERIFY
→
REPEAT

Only after MVP success should AEGIS resume the future roadmap.

============================================================
END OF MUST_BUILD.md

### What we're doing

`AGENT_BUILD_CONTEXT.md` = **how AEGIS is developed + current state**

`Must_build.md` = **what AEGIS must actually accomplish**

This prevents the old problem where “Feature 27 implemented” could look like progress even though the pieces weren't serving the product.

**Next: `Build_plan.md`.**