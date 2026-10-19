import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { createDir, writeFile } from "../../src/tools/filesystem/index.js";
import { runCommand } from "../../src/tools/terminal/index.js";
import { findMatchingRepoSnapshot } from "../../src/intelligence/retrieval/hybridRetriever.js";
import { JsonRepositoryStore } from "../../src/intelligence/storage/jsonStore.js";

function workspaceId(workspace: string): string {
  return fs.realpathSync(workspace).toLowerCase();
}

async function main(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-boundary-"));
  const workspaceA = path.join(root, "same-name");
  const workspaceB = path.join(root, "other", "same-name");
  const outside = path.join(root, "outside");
  fs.mkdirSync(workspaceA, { recursive: true });
  fs.mkdirSync(workspaceB, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  execFileSync("git", ["init", workspaceA], { stdio: "ignore" });
  execFileSync("git", ["init", workspaceB], { stdio: "ignore" });

  try {
    await assert.rejects(
      () => createDir(workspaceA, "new-dir"),
      /GUARDRAIL-BLOCKED/
    );

    const link = path.join(workspaceA, "link");
    fs.symlinkSync(outside, link, "junction");
    await assert.rejects(
      () => writeFile(workspaceA, "link/escaped.txt", "blocked", {
        executionMode: "automatic",
        isApproved: true,
        approvalContext: {
          runId: "run-1",
          approvalId: "approval-1",
          workspace: workspaceId(workspaceA),
          allowedActions: ["write_file"],
          allowedTargets: ["link/escaped.txt"],
        },
      }),
      /Symlink escape/
    );
    assert.strictEqual(fs.existsSync(path.join(outside, "escaped.txt")), false);

    await assert.rejects(
      () => writeFile(workspaceB, "safe.txt", "wrong workspace", {
        executionMode: "automatic",
        isApproved: true,
        approvalContext: {
          runId: "run-1",
          approvalId: "approval-1",
          workspace: workspaceId(workspaceA),
          allowedActions: ["write_file"],
          allowedTargets: ["safe.txt"],
        },
      }),
      /GUARDRAIL-BLOCKED/
    );
    assert.strictEqual(fs.existsSync(path.join(workspaceB, "safe.txt")), false);

    const store = new JsonRepositoryStore(path.join(root, "snapshots"));
    const snapshot = (id: string, repoPath: string) => ({
      repository: {
        id,
        name: "same-name",
        owner: "local",
        url: repoPath,
        provider: "local",
        status: "ready",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        commitSha: "fixture",
        analyzedRevision: "fixture",
      },
      files: [], symbols: [], importsExports: [], dependencies: [], apis: [],
      databases: [], tests: [], gitCommits: [], relationships: [],
    });
    await store.saveSnapshot(snapshot("repo-a", workspaceA) as any);
    await store.saveSnapshot(snapshot("repo-b", workspaceB) as any);
    const matched = await findMatchingRepoSnapshot(workspaceB, store);
    assert.strictEqual(matched?.repository.id, "repo-b");

    process.env.AEGIS_BOUNDARY_SECRET = "must-not-inherit";
    const command = "node -p process.env.AEGIS_BOUNDARY_SECRET";
    const terminal = await runCommand(command, {
      cwd: workspaceA,
      workspaceRoot: workspaceA,
      executionMode: "automatic",
      runId: "run-1",
      isApproved: true,
      approvalContext: {
        runId: "run-1",
        approvalId: "approval-terminal",
        workspace: workspaceId(workspaceA),
        allowedActions: ["execute_terminal"],
        allowedTargets: [command],
      },
    });
    assert.strictEqual(terminal.success, true);
    assert.strictEqual(terminal.stdout.trim(), "undefined");

    const chained = await runCommand("git status && echo chained", {
      cwd: workspaceA,
      workspaceRoot: workspaceA,
      executionMode: "automatic",
    });
    assert.strictEqual(chained.approvalRequired, true);
    assert.strictEqual(chained.blocked, false);
  } finally {
    delete process.env.AEGIS_BOUNDARY_SECRET;
    fs.rmSync(root, { recursive: true, force: true });
  }

  console.log("Execution-boundary acceptance fixtures: 6 / 6 passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
