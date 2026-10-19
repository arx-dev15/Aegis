# AEGIS — Safe Execution Sandbox Security Architecture

## Overview

AEGIS enforces strict process isolation between the agent reasoning engine and untrusted repository code. Untrusted project build, test, and verification commands are executed within a disposable, restricted container sandbox rather than directly on the host machine.

## Architectural Security Boundary

```
+-----------------------------------------------------------+
| Host Environment (Developer Machine / CI Worker)          |
|                                                           |
|  +---------------------+        +----------------------+  |
|  | AEGIS Agent Runtime | -----> | Guardrail Enforcer   |  |
|  | & Approval Gate     |        | (ALLOW/REQUIRE/BLOCK)|  |
|  +---------------------+        +----------------------+  |
|             |                                             |
|      runCommand()                                         |
|             |                                             |
|             v                                             |
|  +-----------------------------------------------------+  |
|  | Safe Execution Sandbox (src/tools/terminal/sandbox) |  |
|  | - Volume Mount Security Validation                 |  |
|  | - Fail-Closed Docker Availability Check            |  |
|  | - Resource & Capability Drop Configuration          |  |
|  +-----------------------------------------------------+  |
+-----------------------------------------------------------+
                              |
                     docker run --rm ...
                              v
+-----------------------------------------------------------+
| Disposable Container Sandbox (node:20-alpine)             |
|                                                           |
|  --network none               (Zero Network Access)       |
|  --read-only                  (Read-Only Root Filesystem) |
|  --tmpfs /tmp:rw,...          (Isolated 64MB Tmpfs)       |
|  --cap-drop ALL               (No Linux Capabilities)     |
|  --security-opt no-new-priv... (No Privilege Escalation)   |
|  --memory 512m --cpus 2.0     (Bounded Resource Limits)   |
|  --pids-limit 128             (Anti-Fork-Bomb Protection) |
|                                                           |
|  Mounted Workspace:                                       |
|  -v /validated/workspace:/workspace:rw                    |
|                                                           |
|  Untrusted Test / Build Process                           |
+-----------------------------------------------------------+
```

## Security Controls

1. **Disposable Lifecycle (`docker run --rm`)**
   Every untrusted command runs in a freshly initialized container with an ephemeral name (`aegis-sandbox-<hex>`). The container is completely removed immediately upon completion or abort.

2. **Network Isolation (`--network none`)**
   By default, sandboxed containers have zero network connectivity. Repository tests and build scripts cannot exfiltrate credentials, download external malicious payloads, or establish reverse shells.

3. **Read-Only Root Filesystem (`--read-only`)**
   The container's root filesystem cannot be modified. Only a constrained 64MB tmpfs at `/tmp` is writable with `noexec,nosuid`.

4. **Privilege Dropping (`--cap-drop ALL`, `no-new-privileges`)**
   All Linux capabilities are dropped. Processes inside the container cannot escalate privileges or manipulate network/system configurations.

5. **Resource Limits**
   - Memory: Bounded (default: 512MB)
   - CPU: Bounded (default: 2.0 cores)
   - PIDs: Bounded (default: 128) to eliminate fork-bomb denial-of-service attacks.

6. **Workspace Mount Security Validation**
   Before launching any container, AEGIS validates the workspace path against strict forbidden patterns:
   - Rejects Docker socket (`/var/run/docker.sock`, named pipes).
   - Rejects host user home directory (`%USERPROFILE%`, `$HOME`, `~`).
   - Rejects filesystem root drives (`C:\`, `/`).
   - Rejects host system directories (`C:\Windows`, `C:\Program Files`, `/etc`, `/usr`, `/bin`).
   - Rejects host credential directories (`.ssh`, `.aws`, `.azure`, `.kube`, `.gnupg`, `.docker`).

7. **Fail-Closed Execution**
   If Docker is not running or the Docker CLI is missing, sandbox-required operations fail closed with an explicit error (`[SANDBOX-UNAVAILABLE]`). AEGIS never silently falls back to running untrusted code on the host.

8. **Trusted Local Admin vs Untrusted Repository Commands**
   Read-only administrative operations performed internally by AEGIS (such as `git status`, `git diff`, `git rev-parse`, or `node --version`) are recognized as trusted host operations and run within the host workspace containment boundary.

9. **Deterministic Timeout & Process Cleanup**
   If execution exceeds `timeoutMs`, AEGIS forcibly kills and removes the container using `docker rm -f <containerName>`, terminating all processes inside the container process tree.

## Documented Remaining Isolation Risks

While disposable containers provide a strong security boundary, containerization does **not** provide absolute, impervious security. The following residual risks remain:

1. **Shared Operating System Kernel**
   Containers share the host Linux kernel (or the WSL2 virtual machine kernel on Windows). Kernel vulnerabilities or 0-day privilege escalations in kernel syscalls could theoretically allow container breakout.

2. **Workspace Mutation**
   Because build and test runners require writing artifacts and caches (e.g. `node_modules`, build outputs, coverage records), the task workspace must be mounted read-write (`:rw`). Malicious code executed during tests can alter, corrupt, or delete files within the mounted workspace directory.

3. **Resource Contention and Local Denial of Service**
   Although CPU, memory, and thread counts are bounded, a malicious process can consume its full allocated quota, cause high disk I/O against the host storage subsystem, or exhaust disk space on the volume hosting the workspace.

4. **WSL2 / Hypervisor Translation on Windows**
   On Windows hosts running Docker Desktop, containers execute inside a lightweight WSL2 Linux virtual machine. Host-container filesystem synchronization traverses hypervisor file sharing protocols (such as 9P or virtiofs), which may introduce subtle filesystem timing differences compared to native Linux.
