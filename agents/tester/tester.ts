/**
 * agents/tester/tester.ts
 *
 * Feature 13 — Tester Agent Implementation
 */

import { z } from "zod";
import { TESTER_SYSTEM_PROMPT } from "./prompt.js";
import { testerResultSchema, TesterResult } from "./types.js";
import { callStructured, GeminiConfig } from "../../models/gemini/index.js";

export interface TesterModel {
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T>;
}

/**
 * Gemini-backed implementation of TesterModel using Aegis's Gemini model layer.
 */
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

export class TesterAgent {
  constructor(
    private model: TesterModel = new GeminiTesterModel()
  ) {}

  async test(task: string, codeChanges?: string): Promise<TesterResult> {
    if (!task.trim()) {
      throw new Error("Tester task cannot be empty.");
    }

    const fullPrompt = codeChanges && codeChanges.trim() !== ""
      ? `${task.trim()}\n\nCode Changes Context:\n${codeChanges.trim()}`
      : task.trim();

    const result = await this.model.generateStructured<TesterResult>(
      TESTER_SYSTEM_PROMPT,
      fullPrompt,
      testerResultSchema
    );

    return testerResultSchema.parse(result);
  }
}
