# Aegis Feature Development & Pull Request Standard

This document defines the standard PR and feature development process for **Aegis**.

---

## 1. Development Principles & Non-Destructive Rule

1. **Additive & Non-Destructive**: Every PR must be additive. Do NOT delete working functionality, rewrite existing application APIs, or replace working frontend/backend components.
2. **Real Data Only**: Production code MUST use real external data (e.g. live `api.github.com` REST APIs, real filesystem operations). Mocks are acceptable strictly inside automated unit test files (`*.test.ts`).
3. **No Over-Engineering**: Do NOT introduce unnecessary abstractions, factory layers, or unrequested dependencies. Keep code TypeScript-first, simple, readable, and properly typed.
4. **Guardrails & Security**: Dangerous system commands and sensitive file/repo mutations must pass through Feature 24 guardrail enforcement (`tools/guardrails/`). Credentials (e.g. `GITHUB_TOKEN`) must never be hardcoded or exposed in logs.

---

## 2. Commit Naming Convention

Commits follow the conventional commit format:

```bash
feat: <feature_name_or_description>
fix: <bug_fix_description>
docs: <documentation_update_description>
test: <test_addition_or_update_description>
```

Examples:
- `feat: implement Repository Intelligence AST parser and relationship graph`
- `fix: resolve state annotation property in failure recovery node`
- `docs: synchronize master architecture and agent flow documentation`

---

## 3. Standard Pull Request Template

Every PR submitted to the Aegis repository must follow this structure:

```markdown
## Summary
Brief description of what feature or bug fix was implemented.

## Changes
- List of new files created
- List of existing files modified

## Architecture & Integration
- Where this change fits in the Aegis architecture (Agents, Graph, Tools, Intelligence, RAG, Memory, API, CLI).
- How the change integrates with existing state and components.

## Existing Functionality Preserved
- Explicit confirmation that existing APIs, agents, graph workflows, and UI components remain fully functional and backward-compatible.

## Verification & Test Results
- TypeScript compilation check (`npx tsc --noEmit`): 0 errors
- Feature-specific unit/integration tests
- Aegis Master Test Runner (`npx tsx testAll.ts`): All test suites passing

## Out of Scope
- Intentionally excluded capabilities or future enhancements deferred to upcoming builds.
```

---

## 4. PR Verification Checklist

Before merging any PR into main, run the following verification pipeline:

1. **TypeScript Type Check**:
   ```bash
   npx tsc --noEmit
   ```
2. **Agentic Type Check**:
   ```bash
   npx tsc --project tsconfig.agentic.json --noEmit
   ```
3. **Master Test Suite Execution**:
   ```bash
   npx tsx testAll.ts
   ```
4. **Documentation Synchronization**: Ensure `AGENT_BUILD_CONTEXT.md` and related architectural docs are updated with completed feature details.