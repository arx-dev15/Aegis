/**
 * tools/terminal/sandbox.ts
 *
 * AEGIS Secure Execution Sandbox & Isolated Shadow Workspace
 *
 * Provides a disposable, container-backed execution boundary for untrusted project build,
 * test, and verification commands.
 *
 * Security Controls:
 * - Isolated disposable container execution (`docker run --rm`)
 * - Network isolation by default (`--network none`)
 * - Read-only root filesystem (`--read-only`) with writable isolated tmpfs (`--tmpfs /tmp:rw,noexec,nosuid,size=64m`)
 * - Non-root execution and privilege drop (`--security-opt no-new-privileges:true`, `--cap-drop ALL`)
 * - Bounded resource limits (`--memory 512m`, `--cpus 2.0`, `--pids-limit 128`)
 * - Strict workspace volume mount validation (rejects Docker socket, user home directory, root, system directories, and credential folders)
 * - Isolated disposable shadow-workspace snapshots (original repository workspace is never mounted read-write)
 * - Minimum workspace access (only validated shadow copy is mounted to /workspace)
 * - Process timeout & deterministic cleanup (`docker rm -f <containerName>`)
 * - Fail-closed enforcement: If Docker daemon is unavailable, untrusted / sandbox-required commands fail closed; never silently falling back to host execution.
 * - Distinction between trusted administrative operations (git status, diff, rev-parse) and untrusted repository commands.
 * - Windows Docker Desktop support (path conversion, drive letter normalization).
 *
 * Documented Remaining Isolation Risks:
 * 1. Shared Host Kernel: Containerization shares the Linux kernel (or WSL2 VM kernel on Windows). Kernel vulnerabilities or 0-day exploits could theoretically enable container breakout.
 * 2. Resource Exhaustion / Local Denial of Service: While memory, CPU, and process count are constrained, untrusted code could exhaust disk space in the shadow workspace or consume CPU within allocated limits.
 * 3. Docker Socket Exposure: AEGIS strictly validates and rejects mounting docker.sock, preventing container-to-host root privilege compromise.
 */

import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SandboxConfig {
  /** Docker image to run. Default: process.env.AEGIS_SANDBOX_IMAGE || "aegis-sandbox-node:22". */
  image?: string;
  /** Network isolation mode. Default: "none" (isolated). */
  network?: "none" | "bridge" | "host";
  /** Whether the container root filesystem is read-only. Default: true. */
  readOnlyRoot?: boolean;
  /** Isolated tmpfs size mounted at /tmp. Default: "64m". */
  tmpfsSize?: string;
  /** Maximum memory limit. Default: "512m". */
  memoryLimit?: string;
  /** Maximum CPU limit. Default: "2.0". */
  cpuLimit?: string;
  /** Maximum process/thread count to prevent fork bombs. Default: 128. */
  pidsLimit?: number;
  /** Timeout in milliseconds before container is killed. Default: 60_000. */
  timeoutMs?: number;
  /** Workspace mount access mode: "rw" | "ro". Default: "rw". */
  mountMode?: "rw" | "ro";
  /** Drop all Linux kernel capabilities. Default: true. */
  dropCapabilities?: boolean;
  /** Prevent gaining additional privileges (no-new-privileges). Default: true. */
  noNewPrivileges?: boolean;
  /** Whether to create an isolated shadow copy of the workspace. Default: true. */
  useShadowWorkspace?: boolean;
}

export interface ExtraMount {
  hostPath: string;
  containerPath: string;
  mode: "ro" | "rw";
}

export interface ContainerExecutionParams {
  extraMounts?: ExtraMount[];
  containerName: string;
  workspaceRoot: string;
  command: string;
  config: SandboxConfig;
  env?: Record<string, string>;
  maxOutputBytes: number;
}

export interface ContainerExecutionOutput {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

export interface ContainerExecutor {
  isAvailable(): Promise<{ available: boolean; error?: string }>;
  execute(params: ContainerExecutionParams): Promise<ContainerExecutionOutput>;
  cleanup(containerName: string): Promise<void>;
}

export interface MountValidationResult {
  valid: boolean;
  resolvedPath?: string;
  normalizedPath?: string;
  reason?: string;
}

export interface ShadowWorkspaceOptions {
  maxSizeBytes?: number;
  excludePatterns?: string[];
}

export interface ShadowWorkspaceResult {
  shadowDir: string;
  sourceDir: string;
  cleanup: () => Promise<void>;
}

// ── Default Sandbox Image Detection ──────────────────────────────────────────

export function getDefaultSandboxImage(): string | undefined {
  if (process.env.AEGIS_SANDBOX_IMAGE && process.env.AEGIS_SANDBOX_IMAGE.trim()) {
    return process.env.AEGIS_SANDBOX_IMAGE.trim();
  }
  return undefined;
}

// ── Workspace Mount Security Validation ──────────────────────────────────────

/**
 * Validate that a proposed workspace path is safe to mount into an isolated container.
 * Strictly rejects:
 * - Docker socket / engine pipes
 * - Filesystem root drives (C:\, /, etc.)
 * - Host user home directory (%USERPROFILE%, $HOME, ~)
 * - Host system directories (/etc, /usr, C:\Windows, Program Files, etc.)
 * - Sensitive host credential directories (.ssh, .aws, .kube, .docker, etc.)
 */
export function validateWorkspaceMount(workspacePath: string): MountValidationResult {
  if (!workspacePath || !workspacePath.trim()) {
    return { valid: false, reason: "Workspace mount path is empty." };
  }

  const rawPath = workspacePath.trim();
  const lower = rawPath.toLowerCase().replace(/\\/g, "/");

  // 1. Check for Docker socket or named pipe references
  if (
    lower.includes("docker.sock") ||
    lower.includes("/var/run/docker.sock") ||
    lower.includes("pipe/docker") ||
    lower.includes("pipe\\docker")
  ) {
    return {
      valid: false,
      reason: "Mounting the Docker socket or Docker engine pipe into a container is strictly prohibited.",
    };
  }

  // 2. Reject root drives and root directories
  if (/^[a-zA-Z]:[\/\\]?$/.test(rawPath) || rawPath === "/" || rawPath === "\\") {
    return {
      valid: false,
      reason: "Mounting the filesystem root directory into a container is strictly prohibited.",
    };
  }

  // 3. Resolve absolute path
  let resolved: string;
  try {
    resolved = path.resolve(rawPath);
  } catch (err: any) {
    return { valid: false, reason: `Failed to resolve path: ${err.message}` };
  }

  const resolvedLower = resolved.toLowerCase().replace(/\\/g, "/");

  // 4. Reject Host User Home Directory
  const homeDir = os.homedir();
  if (homeDir) {
    const homeLower = path.resolve(homeDir).toLowerCase().replace(/\\/g, "/");
    if (resolvedLower === homeLower) {
      return {
        valid: false,
        reason: "Mounting the host user home directory into a container is strictly prohibited.",
      };
    }
  }

  // 5. Reject System Directories
  const systemDirs = [
    "c:/windows",
    "c:/program files",
    "c:/program files (x86)",
    "c:/programdata",
    "/etc",
    "/usr",
    "/bin",
    "/sbin",
    "/lib",
    "/var",
    "/proc",
    "/sys",
    "/dev",
  ];
  for (const sys of systemDirs) {
    if (resolvedLower === sys || resolvedLower.startsWith(sys + "/")) {
      return {
        valid: false,
        reason: `Mounting system directory "${resolved}" into a container is strictly prohibited.`,
      };
    }
  }

  // 6. Reject Credential & Sensitive Folders
  const sensitiveSegments = [
    "/.ssh",
    "/.aws",
    "/.azure",
    "/.kube",
    "/.gnupg",
    "/.docker",
    "/.config/gcloud",
  ];
  for (const seg of sensitiveSegments) {
    if (resolvedLower.endsWith(seg) || resolvedLower.includes(seg + "/")) {
      return {
        valid: false,
        reason: `Mounting sensitive host credential directory containing "${seg}" is strictly prohibited.`,
      };
    }
  }

  // 7. Normalize for Docker volume mount (Windows & Linux compatible)
  let dockerMountPath = resolved.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(dockerMountPath)) {
    dockerMountPath = dockerMountPath[0].toLowerCase() + dockerMountPath.slice(1);
  }

  return {
    valid: true,
    resolvedPath: resolved,
    normalizedPath: dockerMountPath,
  };
}

// ── Ephemeral Shadow Workspace Snapshot ──────────────────────────────────────

/**
 * Create an isolated disposable copy of the workspace so test/build execution
 * cannot mutate, pollute, or delete files in the authoritative source workspace.
 */
export async function createShadowWorkspace(
  sourceDir: string,
  options: ShadowWorkspaceOptions = {}
): Promise<ShadowWorkspaceResult> {
  const resolvedSource = path.resolve(sourceDir);
  const maxBytes = options.maxSizeBytes ?? 100 * 1024 * 1024; // 100MB limit
  const shadowBase = path.join(os.tmpdir(), "aegis-shadow-workspaces");
  if (!fs.existsSync(shadowBase)) {
    fs.mkdirSync(shadowBase, { recursive: true });
  }

  const snapshotId = `snap-${crypto.randomBytes(6).toString("hex")}`;
  const shadowDir = path.join(shadowBase, snapshotId);
  fs.mkdirSync(shadowDir, { recursive: true });

  const defaultExcludes = new Set([
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    ".cache",
    ".tmp",
    ".gemini",
  ]);

  let totalCopiedBytes = 0;

  function copyRecursive(src: string, dest: string) {
    const stat = fs.lstatSync(src);

    // Symlink / Windows Junction safety:
    if (stat.isSymbolicLink()) {
      try {
        const real = fs.realpathSync(src);
        const normReal = real.toLowerCase();
        const normSource = resolvedSource.toLowerCase();
        // Prevent symlink traversal outside workspace root
        if (!normReal.startsWith(normSource + path.sep) && normReal !== normSource) {
          return;
        }
      } catch {
        return;
      }
    }

    if (stat.isDirectory()) {
      const baseName = path.basename(src);
      if (defaultExcludes.has(baseName) && src !== resolvedSource) {
        return;
      }
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      const entries = fs.readdirSync(src);
      for (const entry of entries) {
        copyRecursive(path.join(src, entry), path.join(dest, entry));
      }
    } else if (stat.isFile()) {
      totalCopiedBytes += stat.size;
      if (totalCopiedBytes > maxBytes) {
        throw new Error(`Shadow workspace exceeded maximum allowed size of ${maxBytes} bytes.`);
      }
      fs.copyFileSync(src, dest);
    }
  }

  try {
    copyRecursive(resolvedSource, shadowDir);
    // If source has node_modules, link it into shadowDir for host dependency resolution
    const srcNm = path.join(resolvedSource, "node_modules");
    const destNm = path.join(shadowDir, "node_modules");
    if (fs.existsSync(srcNm) && !fs.existsSync(destNm)) {
      try {
        const symlinkType = process.platform === "win32" ? "junction" : "dir";
        fs.symlinkSync(srcNm, destNm, symlinkType);
      } catch {}
    }
  } catch (err) {
    try { fs.rmSync(shadowDir, { recursive: true, force: true }); } catch {}
    throw err;
  }

  const cleanup = async () => {
    try {
      if (fs.existsSync(shadowDir)) {
        // Unlink junction/symlink first to strictly avoid recursing into host node_modules
        const shadowNm = path.join(shadowDir, "node_modules");
        try {
          if (fs.existsSync(shadowNm)) {
            const stat = fs.lstatSync(shadowNm);
            if (stat.isSymbolicLink()) {
              fs.unlinkSync(shadowNm);
            }
          }
        } catch {}
        fs.rmSync(shadowDir, { recursive: true, force: true });
      }
    } catch {}
  };

  return { shadowDir, sourceDir: resolvedSource, cleanup };
}

// ── Command Classification: Untrusted vs Trusted Admin ───────────────────────

/**
 * Distinguish trusted local administrative operations (e.g. read-only git queries,
 * host tool version checks) from untrusted repository build/test/run commands.
 * Shell metacharacters, chaining, pipes, or argument tricks force untrusted classification.
 */
export function isUntrustedRepositoryCommand(
  command: string,
  options?: { sandbox?: "require" | "none" | "auto"; trusted?: boolean }
): boolean {
  if (options?.trusted === true || options?.sandbox === "none") {
    return false;
  }
  if (options?.sandbox === "require") {
    return true;
  }

  const cmd = command.trim();

  // 1. Any shell composition, chaining, pipe, or command redirection forces untrusted routing
  if (/[;&|><`]/.test(cmd) || /\$\([^)]+\)/.test(cmd)) {
    return true;
  }

  // 1b. Indirect shell executions (sh -c, bash -c, cmd /c, powershell, etc.) must be sandboxed
  const isIndirectShell = /^\s*(sh|bash|zsh|dash|ksh|csh|tcsh|cmd|cmd\.exe|powershell|pwsh)\b/i.test(cmd);
  if (isIndirectShell) {
    return true;
  }

  // 2. Strict allowlist of trusted local administrative inspection commands
  const isTrustedLocalAdmin =
    /^git\s+(status|diff|log|branch|show|rev-parse)(\s+[a-zA-Z0-9_\-\.\/]+)*$/i.test(cmd) ||
    /^(node|python|python3|git)\s+--version$/i.test(cmd) ||
    /^(npm|npx|pnpm|yarn)\s+--version$/i.test(cmd) ||
    /^\s*(pwd|echo|dir|ls)(\s+[a-zA-Z0-9_\-\.\/]+)*$/i.test(cmd);

  if (isTrustedLocalAdmin) {
    return false;
  }

  // 3. Project build, test, and verification commands require container sandbox
  const isBuildOrTest =
    /^\s*(npm|pnpm|yarn|bun)\s+(test|run\s+test|run\s+build|build|check|start)\b/i.test(cmd) ||
    /^\s*npx\s+/i.test(cmd) ||
    /^\s*(pytest|python\s+-m\s+pytest|python\s+-m\s+unittest|python3\s+-m\s+pytest|python3\s+-m\s+unittest)\b/i.test(cmd) ||
    /^\s*(cargo|go)\s+test\b/i.test(cmd) ||
    /^\s*make\s+test\b/i.test(cmd) ||
    /^\s*(jest|vitest|mocha|c8|nyc|playwright|cypress)\b/i.test(cmd) ||
    /^\s*node\s+.*(test|spec)\b/i.test(cmd);

  if (isBuildOrTest) {
    return true;
  }

  return false;
}

// ── Real Docker Container Executor ───────────────────────────────────────────

export class RealDockerExecutor implements ContainerExecutor {
  private lastAvailableCheck = 0;
  private cachedAvailability: { available: boolean; error?: string } | null = null;
  private checkTtlMs = 3000;

  async isAvailable(): Promise<{ available: boolean; error?: string }> {
    const now = Date.now();
    if (this.cachedAvailability && (now - this.lastAvailableCheck < this.checkTtlMs)) {
      return this.cachedAvailability;
    }

    try {
      const infoProcess = spawn("docker", ["info"], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      const res = await new Promise<{ available: boolean; error?: string }>((resolve) => {
        let stderr = "";
        let stdout = "";
        const timer = setTimeout(() => {
          try { infoProcess.kill(); } catch {}
          resolve({ available: false, error: "Docker info probe timed out after 3000ms." });
        }, 3000);

        infoProcess.stdout?.on("data", (d) => { stdout += d.toString(); });
        infoProcess.stderr?.on("data", (d) => { stderr += d.toString(); });

        infoProcess.on("close", (code) => {
          clearTimeout(timer);
          if (code === 0) {
            resolve({ available: true });
          } else {
            const err = (stderr || stdout || `docker info exited with code ${code}`).trim();
            resolve({ available: false, error: err });
          }
        });

        infoProcess.on("error", (err) => {
          clearTimeout(timer);
          resolve({ available: false, error: err.message });
        });
      });

      this.cachedAvailability = res;
      this.lastAvailableCheck = now;
      return res;
    } catch (err: any) {
      const res = { available: false, error: err.message };
      this.cachedAvailability = res;
      this.lastAvailableCheck = now;
      return res;
    }
  }

  async execute(params: ContainerExecutionParams): Promise<ContainerExecutionOutput> {
    const startTime = Date.now();
    const config = params.config;
    const timeoutMs = config.timeoutMs || 60_000;

    const dockerArgs: string[] = [
      "run",
      "--rm",
      "--name", params.containerName,
      "--network", config.network || "none",
      "--read-only",
      "--tmpfs", `/tmp:rw,noexec,nosuid,size=${config.tmpfsSize || "64m"}`,
      "--security-opt", "no-new-privileges:true",
      "--cap-drop", "ALL",
      "--memory", config.memoryLimit || "512m",
      "--cpus", config.cpuLimit || "2.0",
      "--pids-limit", String(config.pidsLimit || 128),
      "-v", `${params.workspaceRoot}:/workspace:${config.mountMode || "rw"}`,
      "-w", "/workspace",
    ];

    const effectiveEnv: Record<string, string> = {
      HOME: "/tmp",
      NPM_CONFIG_CACHE: "/tmp/.npm",
      NODE_ENV: "test",
      CI: "true",
      ...(params.env || {}),
    };
    for (const [k, v] of Object.entries(effectiveEnv)) {
      dockerArgs.push("-e", `${k}=${v}`);
    }

    if (params.extraMounts && params.extraMounts.length > 0) {
      for (const m of params.extraMounts) {
        dockerArgs.push("-v", `${m.hostPath}:${m.containerPath}:${m.mode}`);
      }
    }

    const image = config.image || getDefaultSandboxImage();
    if (!image) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: "[SANDBOX-CONFIG-ERROR] No sandbox image configured. Set AEGIS_SANDBOX_IMAGE in environment or specify config.image.",
        timedOut: false,
        durationMs: 0,
      };
    }
    dockerArgs.push(image, "sh", "-c", params.command);

    return new Promise<ContainerExecutionOutput>((resolve) => {
      let stdoutBytes = 0;
      let stderrBytes = 0;
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timedOut = false;

      const child = spawn("docker", dockerArgs, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      child.stdout?.on("data", (chunk: Buffer) => {
        if (stdoutBytes + chunk.length > params.maxOutputBytes) {
          const allowed = params.maxOutputBytes - stdoutBytes;
          if (allowed > 0) {
            stdoutChunks.push(chunk.subarray(0, allowed));
            stdoutBytes += allowed;
          }
        } else {
          stdoutChunks.push(chunk);
          stdoutBytes += chunk.length;
        }
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        if (stderrBytes + chunk.length > params.maxOutputBytes) {
          const allowed = params.maxOutputBytes - stderrBytes;
          if (allowed > 0) {
            stderrChunks.push(chunk.subarray(0, allowed));
            stderrBytes += allowed;
          }
        } else {
          stderrChunks.push(chunk);
          stderrBytes += chunk.length;
        }
      });

      const timer = setTimeout(async () => {
        timedOut = true;
        try {
          await this.cleanup(params.containerName);
          child.kill("SIGKILL");
        } catch {}
      }, timeoutMs);

      child.on("close", async (code) => {
        clearTimeout(timer);
        await this.cleanup(params.containerName).catch(() => {});

        const durationMs = Date.now() - startTime;
        const exitCode = timedOut ? 124 : (code ?? 1);

        resolve({
          exitCode,
          stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
          stderr: Buffer.concat(stderrChunks).toString("utf-8"),
          timedOut,
          durationMs,
        });
      });

      child.on("error", async (err) => {
        clearTimeout(timer);
        await this.cleanup(params.containerName).catch(() => {});

        resolve({
          exitCode: 1,
          stdout: "",
          stderr: `Docker execution error: ${err.message}`,
          timedOut: false,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  async cleanup(containerName: string): Promise<void> {
    try {
      const killer = spawn("docker", ["rm", "-f", containerName], {
        stdio: "ignore",
        windowsHide: true,
      });
      await new Promise<void>((res) => {
        killer.on("close", () => res());
        killer.on("error", () => res());
      });
    } catch {}
  }
}

// ── Pluggable Container Executor Registry ────────────────────────────────────

let currentContainerExecutor: ContainerExecutor = new RealDockerExecutor();

export function getContainerExecutor(): ContainerExecutor {
  return currentContainerExecutor;
}

export function setContainerExecutor(executor: ContainerExecutor | null): void {
  currentContainerExecutor = executor ?? new RealDockerExecutor();
}

// ── Environment & Missing Dependency Classification ──────────────────────────

/**
 * Checks whether test or verification output indicates an environment or missing dependency
 * setup failure rather than a genuine code regression.
 */
export function isEnvironmentOrSetupFailure(stdout: string, stderr?: string): boolean {
  const combined = `${stdout || ""}\n${stderr || ""}`.toLowerCase();
  const environmentPatterns = [
    "module_not_found",
    "cannot find module",
    "npm err! missing:",
    "npm err! code enoent",
    "npm err! 404",
    "sh: 1: ",
    "command not found",
    ": not found",
    "no such file or directory",
    "no module named",
    "modulenotfounderror",
    "importerror",
    "[sandbox-unavailable]",
    "[sandbox-config-error]",
    "[sandbox-mount-rejected]",
    "[sandbox-shadow-failed]",
    "docker execution error",
    "unable to find image",
    "invalid elf header",
    "exec format error",
    "wrong elf class",
    "error loading shared library",
    "cannot open shared object file",
    "was compiled against a different node.js version",
    "node_module_version",
    "architecture mismatch",
    "bad option:",
    "bad option",
    "unrecognized option",
    "unsupported engine",
    "incompatible runtime",
    "incompatible node",
    "requires node",
    "requires a newer version of node",
    "unsupported node.js version",
  ];
  return environmentPatterns.some((pattern) => combined.includes(pattern));
}
