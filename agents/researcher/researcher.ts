/**
 * agents/researcher/researcher.ts
 *
 * Feature 10 — Researcher Agent Implementation
 */

import { z } from "zod";
import { RESEARCHER_SYSTEM_PROMPT } from "./prompt.js";
import { researchResultSchema, ResearchResult } from "./types.js";
import { callStructured, GeminiConfig } from "../../models/gemini/index.js";

export interface ResearcherModel {
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T>;
}

/**
 * Gemini-backed implementation of ResearcherModel using Aegis's Gemini model layer.
 */
export class GeminiResearcherModel implements ResearcherModel {
  constructor(private config: GeminiConfig = {}) {}

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T> {
    const combinedPrompt = `${systemPrompt.trim()}\n\nResearch Objective:\n${userPrompt.trim()}`;
    return callStructured(combinedPrompt, schema as z.ZodTypeAny, this.config) as Promise<T>;
  }
}

export class ResearcherAgent {
  constructor(
    private model: ResearcherModel = new GeminiResearcherModel()
  ) {}

  async research(objective: string, context?: string, planContext?: string): Promise<ResearchResult> {
    if (!objective.trim()) {
      throw new Error("Research objective cannot be empty.");
    }

    let fullPrompt = objective.trim();

    if (planContext && planContext.trim() !== "") {
      fullPrompt += `\n\n${planContext.trim()}`;
    }

    if (context && context.trim() !== "") {
      fullPrompt += `\n\nAdditional Context:\n${context.trim()}`;
    }

    const result = await this.model.generateStructured<ResearchResult>(
      RESEARCHER_SYSTEM_PROMPT,
      fullPrompt,
      researchResultSchema
    );

    return researchResultSchema.parse(result);
  }
}
