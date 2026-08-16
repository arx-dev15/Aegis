import { z } from "zod";
import { PLANNER_SYSTEM_PROMPT } from "./prompt.js";
import { plannerResultSchema, PlannerResult } from "./types.js";
import { callStructured, GeminiConfig } from "../../models/gemini/index.js";

export interface PlannerModel {
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T>;
}

/**
 * Gemini-backed implementation of PlannerModel using Aegis's Gemini model layer.
 */
export class GeminiPlannerModel implements PlannerModel {
  constructor(private config: GeminiConfig = {}) {}

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T> {
    const combinedPrompt = `${systemPrompt.trim()}\n\nUser Goal:\n${userPrompt.trim()}`;
    return callStructured(combinedPrompt, schema as z.ZodTypeAny, this.config) as Promise<T>;
  }
}

export class PlannerAgent {
  constructor(
    private model: PlannerModel = new GeminiPlannerModel()
  ) {}

  async plan(goal: string): Promise<PlannerResult> {
    if (!goal.trim()) {
      throw new Error("Planner goal cannot be empty.");
    }

    const result = await this.model.generateStructured<PlannerResult>(
      PLANNER_SYSTEM_PROMPT,
      goal,
      plannerResultSchema
    );

    return plannerResultSchema.parse(result);
  }
}