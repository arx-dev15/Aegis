# AEGIS Next Builds

## 1. Purpose

This document contains future AEGIS work that should be considered only after the current MVP is validated.

Feature numbers are historical references only.

The next task must be selected based on the current product state and verified gaps, not by blindly continuing feature numbers.

---

# 2. Current Priority

The current priority is:

> MVP Integration + Validation

No new major feature should take priority over proving that the existing system can complete a real engineering task end-to-end.

Current sequence:

```text
System Audit
    ↓
Integration Gap Fixes
    ↓
Real Engineering Task
    ↓
Failure / Recovery Validation
    ↓
MVP Acceptance
    ↓
Architecture Simplification
    ↓
Product Hardening
    ↓
Advanced Capabilities
3. Phase 1 — System Audit

Status:

NEXT

Purpose:

Determine what the existing implementation actually does at runtime.

Inspect:

application entry points
API entry points
CLI entry points
workflow entry points
graph construction
graph execution
agent invocation
tool invocation
repository intelligence
RAG
memory
GitHub integration
approval flow
terminal execution
testing
review
security
verification
persistence

Output:

Integration Gap Map

The audit must identify:

COMPLETE
INTEGRATED
PARTIAL
STUB
BROKEN
UNUSED
UNKNOWN
4. Phase 2 — MVP Core Integration

Status:

BLOCKED UNTIL AUDIT

Connect the existing components into one real execution path.

Required path:

Task
 ↓
Repository
 ↓
Context
 ↓
Investigation
 ↓
Plan
 ↓
Approval
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
Result

Do not rebuild components that already work.

Fix only the integration gaps identified by the audit.

5. Phase 3 — Real Repository Validation

Status:

PENDING

Run AEGIS against an actual repository.

The repository must contain enough real code to test meaningful engineering behavior.

Validate:

repository discovery
relevant-file identification
repository context
dependency awareness
test discovery
actual file modification
Git diff
test execution

No fabricated repository data is acceptable.

6. Phase 4 — Real Engineering Task

Status:

PENDING

Use a concrete engineering task.

Examples:

Add GET /users/:id and tests.

Fix a failing API test.

Add validation to an existing endpoint.

Fix a documented bug.

Add a small backend feature.

The task should be small enough to verify quickly but large enough to exercise the actual AEGIS workflow.

Success requires:

Task
 ↓
Understanding
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
7. Phase 5 — Failure and Recovery

Status:

PENDING

Intentionally validate at least one realistic failure.

Example:

Developer
 ↓
Tester
 ↓
Test Failure
 ↓
Failure Analysis
 ↓
Recovery
 ↓
Developer
 ↓
Tester
 ↓
Success

Verify that AEGIS preserves useful context rather than blindly restarting the workflow.

Required evidence:

original failure
failure context
recovery decision
attempted fix
second test result
final verification
8. Phase 6 — MVP Acceptance

Status:

PENDING

AEGIS reaches MVP only when the following are demonstrated:

Real Entry

A real user can submit a real engineering task.

Real Repository

AEGIS operates against a real repository.

Repository Understanding

Relevant repository context is actually used.

Real Planning

The system produces an actionable engineering plan.

Approval

Meaningful risky actions respect approval requirements.

Real Implementation

Actual repository files are changed.

Real Testing

Actual project tests or relevant validation commands are executed.

Review

The actual changes are reviewed.

Security

Relevant security checks are performed.

Verification

The final repository state is checked against the requested task.

Evidence

The final result contains concrete evidence.

9. Phase 7 — Architecture Simplification

Status:

DEFERRED

Begin only after MVP validation.

Objectives:

reduce unnecessary files
reduce unnecessary directory nesting
merge trivial modules
remove dead code
remove duplicate systems
simplify workflow structure
reduce unnecessary abstractions
simplify imports
remove obsolete configuration
preserve working capabilities

Required process:

Audit
 ↓
Dependency Map
 ↓
Target Architecture
 ↓
Incremental Refactor
 ↓
Regression Tests
 ↓
Verification

Do not perform this refactor during MVP integration unless a structural problem directly blocks the MVP.

10. Phase 8 — Product Hardening

Status:

FUTURE

After MVP and architecture simplification:

improve error handling
improve workflow observability
improve session persistence
improve approval UX
improve CLI
improve Web/API consistency
improve result/evidence presentation
improve repository intelligence
improve test coverage
improve evaluation

Prioritize problems demonstrated by actual usage.

11. Phase 9 — Advanced Repository Intelligence

Status:

FUTURE

Progressively expand repository understanding:

Files
 ↓
Symbols
 ↓
Imports
 ↓
APIs
 ↓
Database
 ↓
Tests
 ↓
Git History
 ↓
Relationships
 ↓
Impact Analysis

Potential capabilities:

dependency tracing
symbol relationships
change impact analysis
API dependency mapping
test-to-code relationships
database relationship awareness
Git history analysis
architecture awareness

Do not build these merely as isolated features.

Each capability must improve an actual engineering workflow.

12. Phase 10 — Advanced RAG

Status:

FUTURE

Improve retrieval only where repository-aware engineering tasks require it.

Potential areas:

hybrid search
metadata filtering
query rewriting
reranking
structured retrieval
relationship-aware retrieval
retrieval evaluation
task-aware context construction
Graph RAG where justified

Avoid turning AEGIS into a generic RAG product.

13. Phase 11 — Advanced Agent Capabilities

Status:

FUTURE

Potential improvements:

better task decomposition
specialized subagents where justified
contextual recovery
parallel investigation
improved agent handoffs
stronger structured outputs
better planning/replanning
context management
session continuity

Do not add agents unless the responsibility cannot be handled more simply through existing graph logic, tools, or functions.

14. Phase 12 — External Engineering Integrations

Status:

FUTURE / INCREMENTAL

Potential integrations:

GitHub
issue trackers
CI/CD
pull requests
code review systems
documentation systems
MCP servers
development environments

Integrations must be real.

No fake repositories, commits, branches, issues, pull requests, or external results.

15. Phase 13 — CLI

Status:

IMPROVE AFTER MVP

The CLI should eventually provide a practical engineering interface.

Conceptually:

aegis task "Fix the failing authentication test"

Then:

Understand
 ↓
Plan
 ↓
Approval
 ↓
Implement
 ↓
Test
 ↓
Review
 ↓
Verify

The CLI should use the same AEGIS core as the Web/API.

Do not build a separate workflow implementation for the CLI.

16. Phase 14 — Evaluation

Status:

FUTURE

Evaluation should measure actual engineering outcomes.

Potential measurements:

task completion
correctness
regression rate
test success
retrieval relevance
planning quality
recovery success
verification correctness
tool-use correctness
unnecessary changes

Evaluation should support engineering improvement rather than become a standalone benchmark project.

17. Phase 15 — Observability

Status:

FUTURE / HARDENING

AEGIS should make its execution understandable.

Important events include:

Task Started
Repository Loaded
Context Gathered
Agent Started
Agent Completed
Tool Called
Approval Requested
Approval Granted
File Changed
Test Started
Test Failed
Recovery Started
Review Completed
Security Completed
Verification Completed
Task Finished

The objective is to answer:

What did AEGIS do, why did it do it, and what evidence proves the result?

18. Feature Selection Rule

Before implementing any future feature, ask:

Does it solve a demonstrated product problem?
Does the current architecture already provide a way to solve it?
Can it be implemented without duplicating existing systems?
Does it improve the core engineering workflow?
Can its behavior be verified?
Is it necessary now?

If the answer to the last question is no, defer it.

19. Current Rule

Until MVP acceptance:

NO FEATURE EXPANSION

Priority remains:

Inspect
 ↓
Integrate
 ↓
Run
 ↓
Observe
 ↓
Fix
 ↓
Verify

The objective is not to increase the number of AEGIS features.

The objective is to make the existing system function as one real engineering system.