/**
 * agents/architect/architect.ts
 *
 * Feature 11 — Architect Agent Implementation
 */

import { z } from "zod";
import { ARCHITECT_SYSTEM_PROMPT } from "./prompt.js";
import { architectureResultSchema, ArchitectureResult } from "./types.js";
import { callStructured, GeminiConfig } from "../../models/gemini/index.js";

export interface ArchitectModel {
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T>;
}

/**
 * Gemini-backed implementation of ArchitectModel using Aegis's Gemini model layer.
 */
export class GeminiArchitectModel implements ArchitectModel {
  constructor(private config: GeminiConfig = {}) {}

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T> {
    const combinedPrompt = `${systemPrompt.trim()}\n\nArchitectural Requirement:\n${userPrompt.trim()}`;
    return callStructured(combinedPrompt, schema as z.ZodTypeAny, this.config) as Promise<T>;
  }
}

export class ArchitectAgent {
  constructor(
    private model: ArchitectModel = new GeminiArchitectModel()
  ) {}

  async design(goal: string, research?: string, planContext?: string): Promise<ArchitectureResult> {
    if (!goal.trim()) {
      throw new Error("Architect goal cannot be empty.");
    }

    let fullPrompt = goal.trim();

    if (planContext && planContext.trim() !== "") {
      fullPrompt += `\n\n${planContext.trim()}`;
    }

    if (research && research.trim() !== "") {
      fullPrompt += `\n\nResearch Input:\n${research.trim()}`;
    }

    const result = await this.model.generateStructured<ArchitectureResult>(
      ARCHITECT_SYSTEM_PROMPT,
      fullPrompt,
      architectureResultSchema
    );

    return architectureResultSchema.parse(result);
  }
}
