# AEGIS Pull Request / Change Verification

## 1. Purpose

Every meaningful AEGIS change must be reviewed for correctness, integration, regression risk, and evidence before it is considered complete.

This document defines the minimum verification required for a change.

---

# 2. Change Summary

Every change should clearly state:

- What was changed
- Why it was changed
- Which files were affected
- Which existing behavior was preserved
- Which behavior was added or fixed

Avoid unrelated changes.

---

# 3. Implementation Verification

Confirm:

- The intended code was actually changed.
- The implementation matches the requested behavior.
- Existing infrastructure was reused where appropriate.
- No duplicate system was introduced.
- No unnecessary abstraction was introduced.
- No unrelated files were modified.

---

# 4. Integration Verification

A feature must be traced through its real execution path.

Verify:

```text
Entry Point
    ↓
Relevant State
    ↓
Graph / Workflow
    ↓
Agent
    ↓
Tool
    ↓
External / Repository Operation
    ↓
Result

Where applicable, verify that outputs from one stage are actually consumed by the next stage.

A component existing in the repository does not prove integration.

5. Testing

Run the relevant checks.

At minimum, determine whether the change requires:

TypeScript/type checking
Unit tests
Integration tests
API tests
Agent tests
Tool tests
Build
Runtime verification
End-to-end verification

Record the actual result.

Do not report a test as passing unless it was actually executed.

6. Runtime Verification

Where the change affects runtime behavior, perform a real runtime check.

Examples:

API endpoint
    ↓
Real request
    ↓
Real response

or:

AEGIS task
    ↓
Workflow execution
    ↓
Repository change
    ↓
Tests
    ↓
Final result

Runtime behavior should not be inferred solely from compilation or unit tests.

7. Repository Change Verification

For changes that modify a repository:

Verify:

expected files changed
unexpected files did not change
Git diff is reasonable
generated files are intentional
no secrets were introduced
no debugging artifacts remain

The final repository state must match the requested task.

8. Failure Verification

If a change involves error handling or recovery, verify the failure path.

Example:

Operation
    ↓
Failure
    ↓
Error Captured
    ↓
Relevant Context Preserved
    ↓
Recovery
    ↓
Retry / Continue

Do not validate only the successful path when failure handling is part of the feature.

9. Approval Verification

For risky or destructive operations, verify:

Action Requested
    ↓
Approval Required
    ↓
Execution Paused
    ↓
Human Approval
    ↓
Action Executed

Confirm that the action cannot silently bypass the approval gate.

10. Security Verification

For changes involving execution, external integrations, authentication, filesystem access, user input, secrets, or sensitive data, check the relevant security risks.

Examples:

command injection
path traversal
unauthorized access
secret exposure
unsafe command execution
unvalidated input
excessive permissions
insecure external requests

Only report findings supported by the actual implementation.

11. Regression Verification

Confirm that existing functionality remains intact.

At minimum:

run relevant existing tests
check affected workflows
inspect related code paths
verify that existing APIs/contracts were not unintentionally changed

A successful new feature with a broken existing feature is not a successful change.

12. MVP Integration Verification

For AEGIS MVP work, component-level tests are not sufficient.

The following path must eventually be demonstrated:

Real User
    ↓
Real Entry Point
    ↓
Real Engineering Task
    ↓
Real Repository
    ↓
Repository Context
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

At least one realistic failure/recovery path must also be verified.

13. Evidence

Every meaningful change should have concrete evidence.

Examples:

test output
build output
API response
Git diff
changed file
workflow execution result
approval event
tool execution result
verification result

Do not use statements such as:

"This should work."

as verification.

14. Documentation Verification

If behavior changed, check whether the relevant project documentation is now inaccurate.

Update existing documentation when necessary.

Do not create duplicate documentation merely to describe the change.

Documentation must not claim that a feature is integrated or complete without evidence.

15. Change Status

Use one of these states:

NOT IMPLEMENTED
STUB
IMPLEMENTED
INTEGRATED
VALIDATED
COMPLETE
BROKEN
BLOCKED

Meaning:

IMPLEMENTED

The code exists.

INTEGRATED

The code participates in the intended runtime flow.

VALIDATED

Runtime behavior has been tested with concrete evidence.

COMPLETE

The implementation, integration, validation, and required documentation are complete.

Do not use COMPLETE merely because tests compile or pass.

16. Final Change Checklist

Before closing a meaningful change:

[ ] Requirement understood
[ ] Existing implementation inspected
[ ] Smallest reasonable change identified
[ ] Implementation completed
[ ] Relevant tests executed
[ ] Build/type checks executed where relevant
[ ] Runtime behavior verified where relevant
[ ] Integration verified
[ ] Git diff inspected
[ ] Unexpected changes checked
[ ] Security implications checked
[ ] Failure path checked where relevant
[ ] Documentation checked
[ ] Concrete evidence collected
17. Final Result Format

For significant changes, report:

## Changed

- ...

## Files

- ...

## Verified

- ...

## Evidence

- ...

## Remaining

- ...

## Status

IMPLEMENTED / INTEGRATED / VALIDATED / COMPLETE

The status must reflect actual evidence.

18. Core Rule

AEGIS development is successful when the system demonstrates real engineering behavior.

The standard is:

Code exists
    +
Code is integrated
    +
Runtime works
    +
Tests pass
    +
Result is verified
    +
Evidence exists

A passing test suite alone is not proof of a working AEGIS feature.