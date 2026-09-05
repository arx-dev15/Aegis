# Aegis Next Implementation Priorities

This document outlines the ranked upcoming implementation priorities for **Aegis**. Each entry describes the goal, product rationale, dependencies, expected result, and verification criteria.

---

## 1. Build 28 — Terminal & Sandbox Execution `[IN PROGRESS]`

- **Goal**: Provide a sandboxed execution runner for running build commands (`npm run build`), test runners (`npm test`), and git queries (`git diff`, `git status`) inside isolated environments.
- **Why It Matters**: Allows the Developer and Tester agents to execute and verify changes in a controlled environment without compromising the host machine.
- **Dependencies**: Feature 24 (Tool Guardrails) `[COMPLETED]`.
- **Expected Result**: Clean execution of terminal commands with output capture, timeout enforcement, and permission guardrail checks.
- **Verification**: Integration test running safe shell commands and blocking restricted commands.

---

## 2. Build 29 — Model Context Protocol (MCP) Integration `[PLANNED]`

- **Goal**: Implement a standardized MCP server and client interface to allow Aegis agents to connect seamlessly to external tools and services over MCP protocol.
- **Why It Matters**: Replaces custom one-off tool wrappers with a standardized protocol used across the modern AI tool ecosystem.
- **Dependencies**: Feature 03 (Tool System) `[COMPLETED]`.
- **Expected Result**: Agents can dynamically discover and execute tools exposed by external MCP servers.
- **Verification**: Unit and integration tests executing tool calls through an MCP client wrapper.

---

## 3. Build 30 — Session Runtime, Resume & Branching `[PLANNED]`

- **Goal**: Add persistent session checkpointing to allow long-running agent executions to survive process restarts, resume from any checkpoint, and branch tasks.
- **Why It Matters**: Enables complex engineering workflows to run asynchronously and recover from process interruptions or user intervention.
- **Dependencies**: Feature 05 (LangGraph State) `[COMPLETED]`, Feature 23 (Human-in-the-Loop) `[COMPLETED]`.
- **Expected Result**: Agent runs can be saved, listed, rehydrated, and branched using stable session IDs.
- **Verification**: Test pausing an execution, restarting the Node process, and resuming seamlessly from state.

---

## 4. Build 31 — Observability, Tracing & Cost Tracking `[PLANNED]`

- **Goal**: Implement detailed agent run tracing, tracking LLM API calls, latency, token consumption, tool executions, and monetary cost calculations.
- **Why It Matters**: Provides deep visibility into agent trajectory, debugging failures, and managing API token expenses.
- **Dependencies**: Feature 16 (Multi-Agent Workflow) `[COMPLETED]`.
- **Expected Result**: Structured trace output for every agent run detailing step latency, token usage, and execution costs.
- **Verification**: Test verifying trace log emission for multi-agent workflows.

---

## 5. Build 32 — Agent Evaluation & Benchmarks `[PLANNED]`

- **Goal**: Build an automated evaluation suite to benchmark agent performance on planning accuracy, retrieval precision, code generation correctness, and security scanning.
- **Why It Matters**: Ensures new feature additions or prompt tweaks do not cause quality regressions across agent runs.
- **Dependencies**: Feature 16 (Multi-Agent Workflow) `[COMPLETED]`, Feature 26 (Repository Intelligence) `[COMPLETED]`.
- **Expected Result**: Benchmark suite producing quantitative quality scores across deterministic test scenarios.
- **Verification**: Running evaluation runner and verifying score report generation.

---

## 6. Build 33 — Architecture Simplification Refactor `[PLANNED]`

- **Goal**: Perform a non-breaking architectural consolidation to reduce file fragmentation, simplify imports, and streamline internal structures after core features stabilize.
- **Why It Matters**: Keeps the codebase maintainable, readable, and easy to onboard for student developers and engineers.
- **Dependencies**: Stability of Features 01–32.
- **Expected Result**: Consolidated module boundaries with zero loss of functionality, zero API breaking changes, and 100% test suite pass rate.
- **Verification**: Running master test runner (`npx tsx testAll.ts`) and confirming all 25+ test suites pass without error.