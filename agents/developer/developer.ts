/**
 * agents/developer/developer.ts
 *
 * Feature 12 — Developer Agent Implementation
 */

import { z } from "zod";
import { DEVELOPER_SYSTEM_PROMPT } from "./prompt.js";
import { developerResultSchema, DeveloperResult } from "./types.js";
import { callStructured, GeminiConfig } from "../../models/gemini/index.js";

export interface DeveloperModel {
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T>;
}

/**
 * Gemini-backed implementation of DeveloperModel using Aegis's Gemini model layer.
 */
export class GeminiDeveloperModel implements DeveloperModel {
  constructor(private config: GeminiConfig = {}) {}

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T> {
    const combinedPrompt = `${systemPrompt.trim()}\n\nImplementation Request:\n${userPrompt.trim()}`;
    return callStructured(combinedPrompt, schema as z.ZodTypeAny, this.config) as Promise<T>;
  }
}

export class DeveloperAgent {
  constructor(
    private model: DeveloperModel = new GeminiDeveloperModel()
  ) {}

  /**
   * Generate or repair code changes for the given task.
   *
   * @param task             - The engineering task description.
   * @param architecture     - Optional architecture design context.
   * @param recoveryContext  - Optional structured failure context from a previous attempt.
   *                          When provided, the Developer will focus on fixing the issues
   *                          described rather than generating fresh code from scratch.
   * @param existingCodeContext - Optional real existing source code read from workspace files.
   */
  async develop(
    task: string,
    architecture?: string,
    recoveryContext?: string,
    existingCodeContext?: string
  ): Promise<DeveloperResult> {
    if (!task.trim()) {
      throw new Error("Developer task cannot be empty.");
    }

    let fullPrompt = task.trim();

    if (architecture && architecture.trim() !== "") {
      fullPrompt += `\n\nArchitecture Context:\n${architecture.trim()}`;
    }

    if (recoveryContext && recoveryContext.trim() !== "") {
      fullPrompt += `\n\nREPAIR CONTEXT (from previous failed attempt):\n${recoveryContext.trim()}\n\nFocus on fixing the issues described above. Do not regenerate code that already works.`;
    }

    if (existingCodeContext && existingCodeContext.trim() !== "") {
      fullPrompt += `\n\nEXISTING REPOSITORY SOURCE CODE:\n${existingCodeContext.trim()}\n\nInspect the existing source code above carefully. When modifying existing files, preserve existing exports and logic while applying your targeted changes.`;
    }

    const result = await this.model.generateStructured<DeveloperResult>(
      DEVELOPER_SYSTEM_PROMPT,
      fullPrompt,
      developerResultSchema
    );

    return developerResultSchema.parse(result);
  }
}
