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

  async develop(task: string, architecture?: string): Promise<DeveloperResult> {
    if (!task.trim()) {
      throw new Error("Developer task cannot be empty.");
    }

    const fullPrompt = architecture && architecture.trim() !== ""
      ? `${task.trim()}\n\nArchitecture Context:\n${architecture.trim()}`
      : task.trim();

    const result = await this.model.generateStructured<DeveloperResult>(
      DEVELOPER_SYSTEM_PROMPT,
      fullPrompt,
      developerResultSchema
    );

    return developerResultSchema.parse(result);
  }
}
