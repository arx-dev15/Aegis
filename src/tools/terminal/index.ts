/**
 * tools/terminal/index.ts
 *
 * Feature 28 — Controlled Host Execution & Sandbox Boundary
 *
 * Safe terminal command execution engine for Aegis agents.
 * Integrates tool guardrails, human-in-the-loop pre-execution approval,
 * workspace containment, output truncation (100KB), secret scrubbing,
 * process timeout cleanup, disposable container sandboxing for untrusted
 * build/test commands, and structured LangChain tool registration.
 */

import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { enforceToolGuardrail, GuardrailOptions } from "../../security/index.js";
import { createAegisTool, StructuredTool } from "../types.js";
import { ApprovalRequest } from "../../runtime/approvalTypes.js";
import {
  validateWorkspaceMount,
  createShadowWorkspace,
  isUntrustedRepositoryCommand,
  getContainerExecutor,
  setContainerExecutor,
  getDefaultSandboxImage,
  SandboxConfig,
  RealDockerExecutor,
  ContainerExecutor,
  ShadowWorkspaceResult,
  ExtraMount,
  isEnvironmentOrSetupFailure,
} from "./sandbox.js";

export {
  validateWorkspaceMount,
  createShadowWorkspace,
  isUntrustedRepositoryCommand,
  getContainerExecutor,
  setContainerExecutor,
  getDefaultSandboxImage,
  SandboxConfig,
  RealDockerExecutor,
  ContainerExecutor,
  ShadowWorkspaceResult,
  ExtraMount,
  isEnvironmentOrSetupFailure,
};

// ── Active Process & Container Execution Registry for Cancellation ───────────

const activeExecutionsByRun = new Map<string, { abort: () => Promise<void> }>();

function getCoordFile(runId: string): string {
  const dir = path.join(process.cwd(), ".aegis", "runs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${runId}.exec.json`);
}

function writeCoordFile(runId: string, info: { pid?: number; containerName?: string }): void {
  try {
    fs.writeFileSync(getCoordFile(runId), JSON.stringify({ ...info, runId, startedAt: Date.now() }), "utf-8");
  } catch {}
}

function deleteCoordFile(runId: string): void {
  try {
    const p = getCoordFile(runId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

export async function abortRunningCommand(runId: string): Promise<boolean> {
  let aborted = false;
  const active = activeExecutionsByRun.get(runId);
  if (active) {
    try {
      await active.abort();
      aborted = true;
    } catch {}
    activeExecutionsByRun.delete(runId);
  }

  // Cross-process coordination file check
  try {
    const file = getCoordFile(runId);
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (data.containerName) {
        try {
          const killer = spawn("docker", ["rm", "-f", data.containerName], {
            stdio: "ignore",
            windowsHide: true,
          });
          await new Promise<void>((r) => { killer.on("close", () => r()); killer.on("error", () => r()); });
          aborted = true;
        } catch {}
      }
      if (data.pid) {
        try {
          if (process.platform === "win32") {
            const { execSync } = require("child_process");
            execSync(`taskkill /pid ${data.pid} /T /F`, { stdio: "ignore" });
          } else {
            process.kill(data.pid, "SIGKILL");
          }
          aborted = true;
        } catch {}
      }
      deleteCoordFile(runId);
    }
  } catch {}

  return aborted;
}

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
  /** Exact approval status supplied by the owning run after human approval. */
  isApproved?: boolean;
  /** Exact approval scope issued by the owning run. */
  approvalContext?: GuardrailOptions["approvalContext"];
  /** Maximum stdout/stderr output bytes before truncation. Default: 102_400 (100KB). */
  maxOutputBytes?: number;
  /** Sandbox requirement: "require" (must run in container), "none" (host only), "auto" (default: untrusted to container). */
  sandbox?: "require" | "none" | "auto";
  /** Explicitly marks command as trusted local administrative operation. */
  trusted?: boolean;
  /** Custom container sandbox configuration options. */
  sandboxConfig?: Partial<SandboxConfig>;
  /** Whether to create an isolated shadow copy of the workspace. Default: true. */
  useShadowWorkspace?: boolean;
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
  /** Whether the command was executed inside a container sandbox. */
  sandboxed?: boolean;
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
  "GOOGLE_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "DEEPSEEK_API_KEY",
  "LLM_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "JWT_SECRET",
  "AWS_SECRET_ACCESS_KEY",
  "DATABASE_URL",
];

const SAFE_INHERITED_ENV_KEYS = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "WINDIR",
  "ComSpec",
  "TEMP",
  "TMP",
  "HOME",
  "USERPROFILE",
  "LANG",
  "LC_ALL",
  "CI",
];

function buildChildEnvironment(explicitEnv: Record<string, string>): NodeJS.ProcessEnv {
  const inherited = Object.fromEntries(
    SAFE_INHERITED_ENV_KEYS
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key] as string])
  );
  const sensitive = new Set(SENSITIVE_ENV_KEYS.map((key) => key.toUpperCase()));
  const authorized = Object.fromEntries(
    Object.entries(explicitEnv).filter(([key]) => !sensitive.has(key.toUpperCase()))
  );
  return { ...inherited, ...authorized };
}

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
    .replace(/\b(ghp_[A-Za-z0-9_]{20,})\b/g, "ghp_***MASKED***")
    .replace(/\b(github_pat_[A-Za-z0-9_]{20,})\b/g, "github_pat_***MASKED***")
    .replace(/\b(AIzaSy[A-Za-z0-9_-]{30,})\b/g, "AIzaSy***MASKED***")
    .replace(/\b(gsk_[A-Za-z0-9_-]{20,})\b/g, "gsk_***MASKED***")
    .replace(/\b(sk-or-[A-Za-z0-9_-]{20,})\b/g, "sk-or-***MASKED***")
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

  const normCwd = process.platform === "win32" ? resolvedCwd.toLowerCase() : resolvedCwd;
  const normRoot = process.platform === "win32" ? resolvedRoot.toLowerCase() : resolvedRoot;

  if (normCwd !== normRoot && !normCwd.startsWith(normRoot + path.sep)) {
    return {
      valid: false,
      resolvedCwd,
      reason: `Workspace escape attempt blocked: "${resolvedCwd}" is outside workspace root "${resolvedRoot}".`,
    };
  }

  try {
    if (fs.existsSync(resolvedCwd) && fs.existsSync(resolvedRoot)) {
      const realCwd = fs.realpathSync(resolvedCwd);
      const realRoot = fs.realpathSync(resolvedRoot);
      const realCwdCmp = process.platform === "win32" ? realCwd.toLowerCase() : realCwd;
      const realRootCmp = process.platform === "win32" ? realRoot.toLowerCase() : realRoot;
      if (realCwdCmp !== realRootCmp && !realCwdCmp.startsWith(`${realRootCmp}${path.sep}`)) {
        return {
          valid: false,
          resolvedCwd,
          reason: `Workspace escape attempt via symlink/junction blocked: "${resolvedCwd}" points outside workspace.`,
        };
      }
    }
  } catch {}

  return { valid: true, resolvedCwd };
}

// ── Low-Level Command Execution ───────────────────────────────────────────────

/**
 * Execute a terminal command with guardrails, secret protection, process timeout cleanup,
 * output size limits, and container sandbox isolation for untrusted commands.
 */
export async function runCommand(
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
    isApproved = false,
    approvalContext,
    maxOutputBytes = 102_400,
    sandbox = "auto",
    trusted = false,
    sandboxConfig,
  } = options;

  // 1. Workspace Containment Check
  const containment = verifyWorkspaceContainment(cwd, workspaceRoot);
  if (!containment.valid) {
    return {
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
      sandboxed: false,
    };
  }

  // 2. Guardrail Permission Check
  const guard = enforceToolGuardrail({
    toolName: "terminal",
    action: "execute_terminal",
    target: command,
    executionMode,
    runId,
    isApproved,
    approvalContext,
    context: {
      workspaceIdentity: fs.realpathSync(path.resolve(workspaceRoot || cwd)).toLowerCase(),
    },
  });

  if (guard.decision === "BLOCK") {
    return {
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
      sandboxed: false,
    };
  }

  if (guard.decision === "REQUIRE_APPROVAL") {
    return {
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
      sandboxed: false,
    };
  }

  // 3. Check Sandbox Requirement
  const isUntrusted = isUntrustedRepositoryCommand(command, { sandbox, trusted });

  if (isUntrusted) {
    // 3a. Validate workspace mount security
    const mountValidation = validateWorkspaceMount(workspaceRoot || containment.resolvedCwd);
    if (!mountValidation.valid) {
      return {
        command,
        exitCode: 1,
        stdout: "",
        stderr: scrubSecrets(`[SANDBOX-MOUNT-REJECTED] ${mountValidation.reason}`),
        timedOut: false,
        durationMs: 0,
        success: false,
        blocked: true,
        approvalRequired: false,
        truncated: false,
        reason: mountValidation.reason,
        sandboxed: false,
      };
    }

    // 3b. Check Docker availability (fail closed if unavailable)
    const executor = getContainerExecutor();
    const availability = await executor.isAvailable();
    if (!availability.available) {
      const reason = `Docker sandbox unavailable: ${availability.error || "Daemon not running"}. Fail-closed enforced.`;
      return {
        command,
        exitCode: 1,
        stdout: "",
        stderr: scrubSecrets(
          `[SANDBOX-UNAVAILABLE] Docker sandbox daemon is unavailable: ${availability.error || "Daemon not running"}. Untrusted command "${command}" cannot be executed securely on host and failed closed.`
        ),
        timedOut: false,
        durationMs: 0,
        success: false,
        blocked: true,
        approvalRequired: false,
        truncated: false,
        reason,
        sandboxed: false,
      };
    }

    // 3c. Create isolated shadow workspace copy for verification
    let shadowWorkspace: ShadowWorkspaceResult | null = null;
    let targetMountPath = mountValidation.normalizedPath!;

    const shouldShadow = options.useShadowWorkspace !== false && sandboxConfig?.useShadowWorkspace !== false;
    if (shouldShadow) {
      try {
        shadowWorkspace = await createShadowWorkspace(mountValidation.resolvedPath || workspaceRoot || containment.resolvedCwd);
        const shadowValidation = validateWorkspaceMount(shadowWorkspace.shadowDir);
        if (shadowValidation.valid && shadowValidation.normalizedPath) {
          targetMountPath = shadowValidation.normalizedPath;
        }
      } catch (err: any) {
        return {
          command,
          exitCode: 1,
          stdout: "",
          stderr: scrubSecrets(`[SANDBOX-SHADOW-FAILED] Failed to initialize isolated shadow workspace: ${err.message}`),
          timedOut: false,
          durationMs: 0,
          success: false,
          blocked: true,
          approvalRequired: false,
          truncated: false,
          reason: `Failed to create shadow workspace: ${err.message}`,
          sandboxed: false,
        };
      }
    }

    // 3d. Check Sandbox Image Policy
    const resolvedImage = sandboxConfig?.image || getDefaultSandboxImage();
    if (!resolvedImage) {
      if (shadowWorkspace) {
        await shadowWorkspace.cleanup().catch(() => {});
      }
      return {
        command,
        exitCode: 1,
        stdout: "",
        stderr: scrubSecrets(
          "[SANDBOX-CONFIG-ERROR] No sandbox image configured. Set AEGIS_SANDBOX_IMAGE in environment or specify sandboxConfig.image. Refusing to guess, pull images, or execute untrusted code without explicit configuration."
        ),
        timedOut: false,
        durationMs: 0,
        success: false,
        blocked: true,
        approvalRequired: false,
        truncated: false,
        reason: "No sandbox image configured. Set AEGIS_SANDBOX_IMAGE or specify sandboxConfig.image.",
        sandboxed: false,
      };
    }

    // 3e. Prepare Extra Mounts for dependencies
    const extraMounts: ExtraMount[] = [];
    if (shouldShadow && shadowWorkspace) {
      const sourceNm = path.join(shadowWorkspace.sourceDir, "node_modules");
      if (fs.existsSync(sourceNm)) {
        const nmMount = validateWorkspaceMount(sourceNm);
        if (nmMount.valid && nmMount.normalizedPath) {
          extraMounts.push({
            hostPath: nmMount.normalizedPath,
            containerPath: "/workspace/node_modules",
            mode: "ro",
          });
        }
      }
    }

    // 3f. Execute inside disposable container sandbox
    const containerName = `aegis-sandbox-${crypto.randomBytes(6).toString("hex")}`;
    const resolvedConfig: SandboxConfig = {
      image: resolvedImage,
      network: sandboxConfig?.network || "none",
      readOnlyRoot: sandboxConfig?.readOnlyRoot ?? true,
      tmpfsSize: sandboxConfig?.tmpfsSize || "64m",
      memoryLimit: sandboxConfig?.memoryLimit || "512m",
      cpuLimit: sandboxConfig?.cpuLimit || "2.0",
      pidsLimit: sandboxConfig?.pidsLimit || 128,
      timeoutMs: timeoutMs,
      mountMode: sandboxConfig?.mountMode || "rw",
      dropCapabilities: sandboxConfig?.dropCapabilities ?? true,
      noNewPrivileges: sandboxConfig?.noNewPrivileges ?? true,
      useShadowWorkspace: shouldShadow,
    };

    let output;
    if (runId) {
      activeExecutionsByRun.set(runId, {
        abort: async () => {
          await executor.cleanup(containerName).catch(() => {});
        },
      });
      writeCoordFile(runId, { containerName });
    }

    try {
      output = await executor.execute({
        containerName,
        workspaceRoot: targetMountPath,
        command,
        config: resolvedConfig,
        env,
        maxOutputBytes,
        extraMounts,
      });
    } finally {
      if (runId) {
        activeExecutionsByRun.delete(runId);
        deleteCoordFile(runId);
      }
      if (shadowWorkspace) {
        await shadowWorkspace.cleanup().catch(() => {});
      }
    }

    let stdoutStr = output.stdout;
    let stderrStr = output.stderr;
    let isTruncated = false;

    if (stdoutStr.length > maxOutputBytes) {
      stdoutStr = stdoutStr.slice(0, maxOutputBytes) + "\n[OUTPUT TRUNCATED - MAX 100KB EXCEEDED]";
      isTruncated = true;
    }
    if (stderrStr.length > maxOutputBytes) {
      stderrStr = stderrStr.slice(0, maxOutputBytes) + "\n[OUTPUT TRUNCATED - MAX 100KB EXCEEDED]";
      isTruncated = true;
    }

    stdoutStr = scrubSecrets(stdoutStr);
    stderrStr = scrubSecrets(stderrStr);

    return {
      command,
      exitCode: output.exitCode,
      stdout: stdoutStr,
      stderr: stderrStr,
      timedOut: output.timedOut,
      durationMs: output.durationMs,
      success: output.exitCode === 0 && !output.timedOut,
      blocked: false,
      approvalRequired: false,
      truncated: isTruncated,
      reason: output.timedOut ? `Execution timed out after ${resolvedConfig.timeoutMs}ms.` : undefined,
      sandboxed: true,
    };
  }

  // 4. Host Command Execution (Trusted / Allowed)
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

    const childEnv = buildChildEnvironment(env);

    const child = spawn(shell, [shellFlag, command], {
      cwd: containment.resolvedCwd,
      env: childEnv,
    });

    if (runId) {
      activeExecutionsByRun.set(runId, {
        abort: async () => {
          if (child.pid) {
            if (process.platform === "win32") {
              try {
                const { execSync } = require("child_process");
                execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
              } catch {
                child.kill("SIGKILL");
              }
            } else {
              child.kill("SIGKILL");
            }
          }
        },
      });
      if (child.pid) {
        writeCoordFile(runId, { pid: child.pid });
      }
    }

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
      if (runId) {
        activeExecutionsByRun.delete(runId);
        deleteCoordFile(runId);
      }
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
        sandboxed: false,
      });
    });

    child.on("error", (err) => {
      if (runId) {
        activeExecutionsByRun.delete(runId);
        deleteCoordFile(runId);
      }
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
        sandboxed: false,
      });
    });
  });
}

// ── LangChain Tool Registration ───────────────────────────────────────────────

export const TerminalInputSchema = z.object({
  command: z
    .string()
    .min(1, "Command cannot be empty")
    .max(10_000, "Command exceeds maximum length")
    .refine((cmd) => cmd.trim().length > 0, "Command cannot be whitespace only")
    .refine((cmd) => !cmd.includes("\0"), "Command cannot contain null bytes")
    .describe("The terminal shell command to execute (e.g., 'npm test', 'npx tsc --noEmit')"),
  cwd: z.string().optional().describe("Working directory relative to or inside workspace root"),
  executionMode: z.enum(["automatic", "semi-auto", "manual"]).optional().describe("Execution mode for guardrail policy evaluation"),
});

export type TerminalInput = z.infer<typeof TerminalInputSchema>;

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
