/**
 * tools/terminal/index.ts
 *
 * Terminal Tool — Safe command execution for Aegis agents.
 *
 * Runs shell commands inside a configurable working directory,
 * captures stdout and stderr, enforces a timeout, and returns
 * a structured result including exit code and elapsed time.
 *
 * Used by TesterAgent to actually run test commands and get real output.
 *
 * Safety:
 * - Commands run in the provided cwd (not the system root).
 * - Hard timeout prevents infinite hangs.
 * - Does NOT spawn interactive shells; use specific commands.
 */

import { spawn } from "child_process";
import { enforceToolGuardrail } from "../guardrails/index.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RunCommandOptions {
  /** Working directory for the command. Defaults to process.cwd(). */
  cwd?: string;
  /** Environment variables to merge with process.env. */
  env?: Record<string, string>;
  /** Timeout in milliseconds. Default: 60_000 (60 seconds). */
  timeoutMs?: number;
}

export interface CommandResult {
  /** The command that was run. */
  command: string;
  /** Exit code (0 = success). */
  exitCode: number;
  /** Captured stdout. */
  stdout: string;
  /** Captured stderr. */
  stderr: string;
  /** Whether the command timed out. */
  timedOut: boolean;
  /** Elapsed time in milliseconds. */
  durationMs: number;
  /** Whether the command succeeded (exitCode === 0 and no timeout). */
  success: boolean;
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Run a shell command and capture its output.
 *
 * Usage:
 *   const result = await runCommand("npx tsx --version", { cwd: "/my/workspace" });
 *   console.log(result.stdout, result.exitCode);
 */
export function runCommand(
  command: string,
  options: RunCommandOptions = {}
): Promise<CommandResult> {
  const { cwd = process.cwd(), env = {}, timeoutMs = 60_000 } = options;

  const guard = enforceToolGuardrail({
    toolName: "terminal",
    action: "execute_terminal",
    target: command,
  });

  if (!guard.allowed) {
    return Promise.resolve({
      command,
      exitCode: 1,
      stdout: "",
      stderr: `[GUARDRAIL-BLOCKED] ${guard.reason}`,
      timedOut: false,
      durationMs: 0,
      success: false,
    });
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;

    // On Windows use cmd /c, on Unix use sh -c
    const isWindows = process.platform === "win32";
    const [shell, shellFlag] = isWindows
      ? ["cmd", "/c"]
      : ["sh", "-c"];

    const child = spawn(shell, [shellFlag, command], {
      cwd,
      env: { ...process.env, ...env },
      // Do not inherit stdio — we want to capture
    });

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      const exitCode = code ?? 1;

      resolve({
        command,
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
        timedOut,
        durationMs,
        success: exitCode === 0 && !timedOut,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        command,
        exitCode: 1,
        stdout: "",
        stderr: err.message,
        timedOut: false,
        durationMs: Date.now() - startTime,
        success: false,
      });
    });
  });
}
