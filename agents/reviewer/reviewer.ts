/**
 * agents/reviewer/reviewer.ts
 *
 * Feature 14 — Reviewer Agent Implementation
 */

import { z } from "zod";
import { REVIEWER_SYSTEM_PROMPT } from "./prompt.js";
import { reviewerResultSchema, ReviewerResult } from "./types.js";
import { callStructured, GeminiConfig } from "../../models/gemini/index.js";

export interface ReviewerModel {
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T>;
}

/**
 * Gemini-backed implementation of ReviewerModel using Aegis's Gemini model layer.
 */
export class GeminiReviewerModel implements ReviewerModel {
  constructor(private config: GeminiConfig = {}) {}

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T> {
    const combinedPrompt = `${systemPrompt.trim()}\n\nCode Review Request:\n${userPrompt.trim()}`;
    return callStructured(combinedPrompt, schema as z.ZodTypeAny, this.config) as Promise<T>;
  }
}

export class ReviewerAgent {
  constructor(
    private model: ReviewerModel = new GeminiReviewerModel()
  ) {}

  async review(task: string, codeChanges?: string, testResults?: string): Promise<ReviewerResult> {
    if (!task.trim()) {
      throw new Error("Reviewer task cannot be empty.");
    }

    let fullPrompt = task.trim();
    if (codeChanges && codeChanges.trim() !== "") {
      fullPrompt += `\n\nCode Changes:\n${codeChanges.trim()}`;
    }
    if (testResults && testResults.trim() !== "") {
      fullPrompt += `\n\nTest Execution Evidence:\n${testResults.trim()}`;
    }

    const result = await this.model.generateStructured<ReviewerResult>(
      REVIEWER_SYSTEM_PROMPT,
      fullPrompt,
      reviewerResultSchema
    );

    return reviewerResultSchema.parse(result);
  }
}
