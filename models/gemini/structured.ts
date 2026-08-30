/**
 * models/gemini/structured.ts
 *
 * Feature 02 — Structured Output
 *
 * Provides `callStructured<T>()` — calls Gemini with a Zod schema and
 * returns a fully-typed, validated structured object.
 *
 * How it works:
 *  1. Convert the Zod schema to Google's Schema format.
 *  2. Call Gemini with `responseMimeType: "application/json"` + `responseSchema`.
 *     This forces the model to return JSON that matches the shape.
 *  3. Strip `null` values (Google uses null for absent optional fields;
 *     Zod's z.optional() expects undefined, not null).
 *  4. Parse and validate the JSON with Zod for TypeScript type safety.
 *  5. Retry once on transient 5xx errors.
 *
 * Uses the existing `getClient()` from Feature 01. Does not modify it.
 */

import { z } from "zod";
import { Type, type Schema } from "@google/genai";
import { getClient } from "./model.js";
import type { GeminiConfig } from "./model.js";

// ── Zod → Google Schema converter ───────────────────────────────────────────

/**
 * Convert a Zod schema to a Google API Schema object.
 * Handles: object, string, number, boolean, array, enum, optional.
 *
 * Uses `any` internally — Zod v4 splits its type hierarchy into public
 * (`ZodType`) and internal (`$ZodType`) classes, which breaks TypeScript
 * narrowing when iterating shape entries. The public `callStructured` API
 * is still fully typed; this function is a private implementation detail.
 *
 * Optional fields: we do NOT set `nullable: true`. Instead we omit the key
 * from the `required` array. This avoids the model returning `null` for
 * optional fields (which Zod's z.optional() rejects — it expects undefined).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodToGoogleSchema(zSchema: any): Schema {
  // Optional — unwrap, but do NOT mark nullable (keep omittable via required[])
  if (zSchema instanceof z.ZodOptional) {
    return zodToGoogleSchema(zSchema.unwrap());
  }

  // Object
  if (zSchema instanceof z.ZodObject) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shape = zSchema.shape as Record<string, any>;
    const properties: Record<string, Schema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToGoogleSchema(value);
      // Only add to required if the field is NOT optional
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return { type: Type.OBJECT, properties, required };
  }

  // Array
  if (zSchema instanceof z.ZodArray) {
    return { type: Type.ARRAY, items: zodToGoogleSchema(zSchema.element) };
  }

  // Enum
  if (zSchema instanceof z.ZodEnum) {
    return { type: Type.STRING, enum: zSchema.options as string[] };
  }

  // Primitives
  if (zSchema instanceof z.ZodString)  return { type: Type.STRING };
  if (zSchema instanceof z.ZodNumber)  return { type: Type.NUMBER };
  if (zSchema instanceof z.ZodBoolean) return { type: Type.BOOLEAN };

  // Fallback — treat as string
  return { type: Type.STRING };
}

// ── Null stripper ─────────────────────────────────────────────────────────────

/**
 * Recursively replace `null` with `undefined` in an object.
 * Needed because the Google API can return `null` for absent optional fields,
 * while Zod's z.optional() expects the key to be missing or `undefined`.
 */
function stripNulls(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(stripNulls);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => [k, stripNulls(v)])
        .filter(([, v]) => v !== undefined) // drop undefined keys entirely
    );
  }
  return value;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Call Gemini and return a structured, Zod-validated response.
 *
 * @param prompt  - The instruction/question for the model.
 * @param schema  - A Zod schema describing the expected output shape.
 * @param config  - Optional model config (model name, temperature, etc.).
 * @returns       A typed object that satisfies the Zod schema.
 *
 * Example:
 *   const PlanSchema = z.object({ steps: z.array(z.string()), risk: z.string() });
 *   const plan = await callStructured("Plan a refactor", PlanSchema);
 *   console.log(plan.steps); // string[]
 */
export async function callStructured<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T,
  config: GeminiConfig = {}
): Promise<z.infer<T>> {
  const client = getClient();
  const modelName = config.model ?? "gemini-3.5-flash";

  // Retry up to 3 times on transient errors with exponential backoff (2s, 4s, 8s)
  async function callOnce(): Promise<z.infer<T>> {
    const response = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: config.temperature ?? 0.2,
        responseMimeType: "application/json",
        responseSchema: zodToGoogleSchema(schema),
      },
    });

    const text = response.text ?? "";
    const parsed = JSON.parse(text);

    // Strip nulls before Zod validation (Google returns null for absent optional fields)
    const cleaned = stripNulls(parsed);

    return schema.parse(cleaned) as z.infer<T>;
  }

  const MAX_RETRIES = 3;
  let lastError: unknown;

  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      return await callOnce();
    } catch (err) {
      lastError = err;
      const msg = String(err);
      const isTransient =
        msg.includes("503") ||
        msg.includes("429") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("high demand");

      if (isTransient && i < MAX_RETRIES) {
        const backoffMs = Math.pow(2, i + 1) * 1000; // 2s, 4s, 8s
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
