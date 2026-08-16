/**
 * agents/security/security.ts
 *
 * Feature 15 — Security Agent Implementation
 */

import { z } from "zod";
import { SECURITY_SYSTEM_PROMPT } from "./prompt.js";
import { securityResultSchema, SecurityResult } from "./types.js";
import { callStructured, GeminiConfig } from "../../models/gemini/index.js";

export interface SecurityModel {
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T>;
}

/**
 * Gemini-backed implementation of SecurityModel using Aegis's Gemini model layer.
 */
export class GeminiSecurityModel implements SecurityModel {
  constructor(private config: GeminiConfig = {}) {}

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown
  ): Promise<T> {
    const combinedPrompt = `${systemPrompt.trim()}\n\nSecurity Audit Request:\n${userPrompt.trim()}`;
    return callStructured(combinedPrompt, schema as z.ZodTypeAny, this.config) as Promise<T>;
  }
}

export class SecurityAgent {
  constructor(
    private model: SecurityModel = new GeminiSecurityModel()
  ) {}

  async audit(task: string, codeChanges?: string, architecture?: string): Promise<SecurityResult> {
    if (!task.trim()) {
      throw new Error("Security audit task cannot be empty.");
    }

    let fullPrompt = task.trim();
    if (codeChanges && codeChanges.trim() !== "") {
      fullPrompt += `\n\nCode Changes:\n${codeChanges.trim()}`;
    }
    if (architecture && architecture.trim() !== "") {
      fullPrompt += `\n\nArchitecture Specification:\n${architecture.trim()}`;
    }

    const result = await this.model.generateStructured<SecurityResult>(
      SECURITY_SYSTEM_PROMPT,
      fullPrompt,
      securityResultSchema
    );

    return securityResultSchema.parse(result);
  }
}
