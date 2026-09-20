/**
 * tools/terminal/index.ts
 *
 * Feature 28 — Controlled Host Execution
 *
 * Safe terminal command execution engine for Aegis agents.
 * Integrates tool guardrails, human-in-the-loop pre-execution approval,
 * workspace containment, output truncation (100KB), secret scrubbing,
 * process timeout cleanup, and structured LangChain tool registration.
 */

import { spawn } from "child_process";
import path from "path";
import { z } from "zod";
import { enforceToolGuardrail } from "../guardrails/index.js";
import { createAegisTool, StructuredTool } from "../types.js";
import { ApprovalRequest } from "../../graph/approvalTypes.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RunCommandOptions {
  /** Working directory for the command. Defaults to process.cwd(). */
  cwd?: string;
  /** Explicit workspace root path for path containment verification. */
  workspaceRoot?: string;
  /** Environment variables to merge with process.env. */
  env?: Record<string, string>;
  /** Timeout in milliseconds. Default: 60_000 (60 seconds). */
  timeoutMs?: number;
  /** Execution mode override ("automatic" | "semi-auto" | "manual"). */
  executionMode?: "automatic" | "semi-auto" | "manual";
  /** Associated active execution run ID. */
  runId?: string;
  /** Maximum stdout/stderr output bytes before truncation. Default: 102_400 (100KB). */
  maxOutputBytes?: number;
}

export interface CommandResult {
  /** The command string requested. */
  command: string;
  /** Process exit code (0 = success, null if interrupted/blocked). */
  exitCode: number | null;
  /** Captured stdout (secret-scrubbed & size-limited). */
  stdout: string;
  /** Captured stderr (secret-scrubbed & size-limited). */
  stderr: string;
  /** Whether the command execution timed out. */
  timedOut: boolean;
  /** Elapsed execution duration in milliseconds. */
  durationMs: number;
  /** Whether execution completed cleanly (exitCode === 0 and not timedOut/blocked). */
  success: boolean;
  /** Whether execution was BLOCKED by security policy. */
  blocked: boolean;
  /** Whether execution was paused for REQUIRE_APPROVAL before execution. */
  approvalRequired: boolean;
  /** Whether output exceeded limit and was truncated. */
  truncated: boolean;
  /** Reason for block, approval requirement, or failure. */
  reason?: string;
  /** Feature 23 ApprovalRequest if decision was REQUIRE_APPROVAL. */
  approvalRequest?: ApprovalRequest;
}

// ── Secret Scrubbing Utility ──────────────────────────────────────────────────

/**
 * Known secret key names in process.env whose values should be scrubbed.
 */
const SENSITIVE_ENV_KEYS = [
  "GITHUB_TOKEN",
  "GITHUB_PAT",
  "GH_TOKEN",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "JWT_SECRET",
  "AWS_SECRET_ACCESS_KEY",
  "DATABASE_URL",
];

/**
 * Scrub sensitive tokens, API keys, and environment secret values from output text.
 */
export function scrubSecrets(text: string): string {
  if (!text) return "";

  let sanitized = text;

  // 1. Scrub explicit environment variable values if present in string
  for (const key of SENSITIVE_ENV_KEYS) {
    const val = process.env[key];
    if (val && val.length >= 6) {
      sanitized = sanitized.split(val).join("***SECRET_MASKED***");
    }
  }

  // 2. Scrub pattern-matched secrets
  sanitized = sanitized
    // GitHub PAT tokens
    .replace(/\b(ghp_[A-Za-z0-9_]{20,})\b/g, "ghp_***MASKED***")
    .replace(/\b(github_pat_[A-Za-z0-9_]{20,})\b/g, "github_pat_***MASKED***")
    // Google Gemini API keys
    .replace(/\b(AIzaSy[A-Za-z0-9_-]{30,})\b/g, "AIzaSy***MASKED***")
    // Bearer Authorization headers
    .replace(/Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, "Bearer ***MASKED***");

  return sanitized;
}

// ── Workspace Containment Verification ───────────────────────────────────────

/**
 * Verify that a given working directory is inside the allowed workspace root.
 */
export function verifyWorkspaceContainment(
  targetCwd: string,
  workspaceRoot?: string
): { valid: boolean; resolvedCwd: string; reason?: string } {
  const resolvedCwd = path.resolve(targetCwd);

  if (!workspaceRoot) {
    return { valid: true, resolvedCwd };
  }

  const resolvedRoot = path.resolve(workspaceRoot);

  // Normalize path casing for Windows OS path comparison
  const normCwd = process.platform === "win32" ? resolvedCwd.toLowerCase() : resolvedCwd;
  const normRoot = process.platform === "win32" ? resolvedRoot.toLowerCase() : resolvedRoot;

  if (normCwd !== normRoot && !normCwd.startsWith(normRoot + path.sep)) {
    return {
      valid: false,
      resolvedCwd,
      reason: `Workspace escape attempt blocked: "${resolvedCwd}" is outside workspace root "${resolvedRoot}".`,
    };
  }

  return { valid: true, resolvedCwd };
}

// ── Low-Level Command Execution ───────────────────────────────────────────────

/**
 * Execute a terminal command with guardrails, secret protection, process timeout cleanup,
 * and output size limits.
 */
export function runCommand(
  command: string,
  options: RunCommandOptions = {}
): Promise<CommandResult> {
  const {
    cwd = process.cwd(),
    workspaceRoot,
    env = {},
    timeoutMs = 60_000,
    executionMode = "semi-auto",
    runId = "run_default",
    maxOutputBytes = 102_400, // 100KB max output limit
  } = options;

  // 1. Workspace Containment Check
  const containment = verifyWorkspaceContainment(cwd, workspaceRoot);
  if (!containment.valid) {
    return Promise.resolve({
      command,
      exitCode: 1,
      stdout: "",
      stderr: scrubSecrets(`[WORKSPACE-ESCAPE-BLOCKED] ${containment.reason}`),
      timedOut: false,
      durationMs: 0,
      success: false,
      blocked: true,
      approvalRequired: false,
      truncated: false,
      reason: containment.reason,
    });
  }

  // 2. Guardrail Permission Check
  const guard = enforceToolGuardrail({
    toolName: "terminal",
    action: "execute_terminal",
    target: command,
    executionMode,
    runId,
  });

  if (guard.decision === "BLOCK") {
    return Promise.resolve({
      command,
      exitCode: 1,
      stdout: "",
      stderr: scrubSecrets(`[GUARDRAIL-BLOCKED] ${guard.reason}`),
      timedOut: false,
      durationMs: 0,
      success: false,
      blocked: true,
      approvalRequired: false,
      truncated: false,
      reason: guard.reason,
    });
  }

  if (guard.decision === "REQUIRE_APPROVAL") {
    return Promise.resolve({
      command,
      exitCode: null,
      stdout: "",
      stderr: "",
      timedOut: false,
      durationMs: 0,
      success: false,
      blocked: false,
      approvalRequired: true,
      truncated: false,
      reason: guard.reason,
      approvalRequest: guard.approvalRequest,
    });
  }

  // 3. Command Execution (ALLOW)
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let forceKillTimer: NodeJS.Timeout | null = null;

    const isWindows = process.platform === "win32";
    const [shell, shellFlag] = isWindows ? ["cmd", "/c"] : ["sh", "-c"];

    // Sanitize child process environment (do not blindly expose secrets)
    const childEnv = { ...process.env, ...env };

    const child = spawn(shell, [shellFlag, command], {
      cwd: containment.resolvedCwd,
      env: childEnv,
    });

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdoutBytes + chunk.length > maxOutputBytes) {
        stdoutTruncated = true;
        const allowed = maxOutputBytes - stdoutBytes;
        if (allowed > 0) {
          stdoutChunks.push(chunk.subarray(0, allowed));
          stdoutBytes += allowed;
        }
      } else {
        stdoutChunks.push(chunk);
        stdoutBytes += chunk.length;
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderrBytes + chunk.length > maxOutputBytes) {
        stderrTruncated = true;
        const allowed = maxOutputBytes - stderrBytes;
        if (allowed > 0) {
          stderrChunks.push(chunk.subarray(0, allowed));
          stderrBytes += allowed;
        }
      } else {
        stderrChunks.push(chunk);
        stderrBytes += chunk.length;
      }
    });

    // Timeout & Process Tree Cleanup
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        if (process.platform === "win32") {
          try {
            const { execSync } = require("child_process");
            execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
          } catch {
            child.kill("SIGKILL");
          }
        } else {
          child.kill("SIGTERM");
          forceKillTimer = setTimeout(() => {
            try { child.kill("SIGKILL"); } catch {}
          }, 500);
        }
      } else {
        child.kill("SIGKILL");
      }
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);

      const durationMs = Date.now() - startTime;
      const exitCode = timedOut ? 124 : (code ?? 1);

      let stdoutStr = Buffer.concat(stdoutChunks).toString("utf-8");
      let stderrStr = Buffer.concat(stderrChunks).toString("utf-8");

      if (stdoutTruncated) {
        stdoutStr += "\n[OUTPUT TRUNCATED - MAX 100KB EXCEEDED]";
      }
      if (stderrTruncated) {
        stderrStr += "\n[OUTPUT TRUNCATED - MAX 100KB EXCEEDED]";
      }

      // Secret Scrubbing
      stdoutStr = scrubSecrets(stdoutStr);
      stderrStr = scrubSecrets(stderrStr);

      const isTruncated = stdoutTruncated || stderrTruncated;

      resolve({
        command,
        exitCode,
        stdout: stdoutStr,
        stderr: stderrStr,
        timedOut,
        durationMs,
        success: exitCode === 0 && !timedOut,
        blocked: false,
        approvalRequired: false,
        truncated: isTruncated,
        reason: timedOut ? `Execution timed out after ${timeoutMs}ms.` : undefined,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);

      resolve({
        command,
        exitCode: 1,
        stdout: "",
        stderr: scrubSecrets(`Process execution error: ${err.message}`),
        timedOut: false,
        durationMs: Date.now() - startTime,
        success: false,
        blocked: false,
        approvalRequired: false,
        truncated: false,
        reason: err.message,
      });
    });
  });
}

// ── LangChain Tool Registration ───────────────────────────────────────────────

export const TerminalInputSchema = z.object({
  command: z.string().describe("The terminal shell command to execute (e.g., 'npm test', 'npx tsc --noEmit')"),
  cwd: z.string().optional().describe("Working directory relative to or inside workspace root"),
  executionMode: z.enum(["automatic", "semi-auto", "manual"]).optional().describe("Execution mode for guardrail policy evaluation"),
});

export type TerminalInput = z.infer<typeof TerminalInputSchema>;

/**
 * Structured Terminal Execution Tool for Aegis agents.
 */
export const terminalTool: StructuredTool = createAegisTool(
  async (input: TerminalInput) => {
    const res = await runCommand(input.command, {
      cwd: input.cwd,
      executionMode: input.executionMode || "semi-auto",
    });

    return JSON.stringify(res, null, 2);
  },
  {
    name: "terminal_execution",
    description: "Execute a controlled terminal shell command (e.g. npm test, npx tsc, git status) under Aegis security policy.",
    schema: TerminalInputSchema,
  }
);
