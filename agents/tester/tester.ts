/**
 * agents/tester/tester.ts
 *
 * Feature 13 (upgraded in Feature 16) — Tester Agent Implementation
 *
 * The TesterAgent has two operating modes:
 *
 * 1. LLM-only mode (simulation):
 *    Uses Gemini to reason about code changes and generate a structured
 *    TesterResult. This is the default when no TerminalRunner is provided.
 *    Used by all existing tests — no test modification needed.
 *
 * 2. Real execution mode:
 *    If a TerminalRunner is provided (e.g., in developerNode when workspace is set),
 *    the agent runs the actual test command in the workspace, then asks Gemini
 *    to interpret the real stdout/stderr into a structured TesterResult.
 *    This is what bridges AI reasoning with real evidence.
 *
 * This design keeps the model interface clean and tests fully isolated.
 */

import { z } from "zod";
import { TESTER_SYSTEM_PROMPT } from "./prompt.js";
import { testerResultSchema, TesterResult } from "./types.js";
import { callStructured, GeminiConfig } from "../../models/gemini/index.js";

// ── Model Interface ──────────────────────────────────────────────────────────

export interface TesterModel {
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T>;
}

// ── Terminal Interface (injected for real execution) ─────────────────────────

export interface TerminalRunner {
  run(command: string, cwd: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    durationMs: number;
    success: boolean;
    timedOut?: boolean;
    blocked?: boolean;
    approvalRequired?: boolean;
    truncated?: boolean;
    reason?: string;
  }>;
}

// ── Gemini Model Implementation ───────────────────────────────────────────────

export class GeminiTesterModel implements TesterModel {
  constructor(private config: GeminiConfig = {}) {}

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T> {
    const combinedPrompt = `${systemPrompt.trim()}\n\nVerification Target:\n${userPrompt.trim()}`;
    return callStructured(combinedPrompt, schema as z.ZodTypeAny, this.config) as Promise<T>;
  }
}

// ── Tester Agent ──────────────────────────────────────────────────────────────

export class TesterAgent {
  constructor(
    private model: TesterModel = new GeminiTesterModel(),
    private terminal?: TerminalRunner
  ) {}

  /**
   * Test the implementation.
   *
   * If terminal + workspace + testCommand are provided, runs the command for real
   * and feeds actual stdout/stderr to Gemini to interpret.
   *
   * Otherwise falls back to pure LLM reasoning from code change context.
   */
  async test(
    task: string,
    codeChanges?: string,
    options?: { workspace?: string; testCommand?: string }
  ): Promise<TesterResult> {
    if (!task.trim()) {
      throw new Error("Tester task cannot be empty.");
    }

    let realOutput: string | null = null;

    // ── Real execution (when terminal + workspace are available) ──────────
    if (
      this.terminal &&
      options?.workspace &&
      options.workspace.trim() !== "" &&
      options?.testCommand &&
      options.testCommand.trim() !== ""
    ) {
      const result = await this.terminal.run(
        options.testCommand,
        options.workspace
      );

      realOutput = [
        `$ ${options.testCommand}`,
        `Exit Code: ${result.exitCode}`,
        `Duration: ${result.durationMs}ms`,
        `Success: ${result.success}`,
        result.timedOut ? `[TIMED OUT]` : "",
        result.blocked ? `[GUARDRAIL BLOCKED: ${result.reason || ""}]` : "",
        result.approvalRequired ? `[APPROVAL REQUIRED: ${result.reason || ""}]` : "",
        result.truncated ? `[OUTPUT TRUNCATED]` : "",
        result.stdout ? `STDOUT:\n${result.stdout}` : "",
        result.stderr ? `STDERR:\n${result.stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    // ── Build the prompt with all context available ───────────────────────
    let fullPrompt = task.trim();

    if (codeChanges && codeChanges.trim() !== "") {
      fullPrompt += `\n\nCode Changes Applied:\n${codeChanges.trim()}`;
    }

    if (realOutput) {
      fullPrompt += `\n\nReal Test Execution Output:\n${realOutput}`;
    }

    const result = await this.model.generateStructured<TesterResult>(
      TESTER_SYSTEM_PROMPT,
      fullPrompt,
      testerResultSchema
    );

    return testerResultSchema.parse(result);
  }
}
