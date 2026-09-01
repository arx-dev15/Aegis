/**
 * demoGithub.ts
 *
 * Feature 25 — Aegis Real GitHub Integration Execution Script
 *
 * Executes 100% REAL live GitHub tool requests against https://api.github.com.
 * ZERO hardcoded, mock, or fake static JSON responses.
 *
 * Usage:
 *   npx tsx demoGithub.ts
 */

import dotenv from "dotenv";
dotenv.config();

import { GitHubClient, executeGithubOperation } from "./tools/github/index.js";

async function runRealGithubExecution() {
  const token = process.env.GITHUB_TOKEN || "";
  const hasToken = Boolean(token && token.trim() !== "");

  console.log("=================================================");
  console.log("  AEGIS REAL-TIME GITHUB EXECUTION ENGINE");
  console.log("=================================================");
  console.log(` Status: ${hasToken ? "🔒 AUTHENTICATED (GITHUB_TOKEN present)" : "🌐 PUBLIC READ-ONLY (No GITHUB_TOKEN configured)"}\n`);

  const client = new GitHubClient({ token });
  const owner = "octocat";
  const repo = "Hello-World";

  // ── 1. Real-Time Repository Metadata (GET /repos/octocat/Hello-World) ──────
  console.log(`-------------------------------------------------`);
  console.log(`1. Real API GET: get_repository (${owner}/${repo})`);
  console.log(`-------------------------------------------------`);

  const repoRes = await executeGithubOperation(
    { operation: "get_repository", owner, repository: repo },
    client
  );
  console.log(repoRes);

  // ── 2. Real-Time Branch Listing (GET /repos/octocat/Hello-World/branches) ──
  console.log(`\n-------------------------------------------------`);
  console.log(`2. Real API GET: list_branches (${owner}/${repo})`);
  console.log(`-------------------------------------------------`);

  const branchesRes = await executeGithubOperation(
    { operation: "list_branches", owner, repository: repo },
    client
  );
  console.log(branchesRes);

  // ── 3. Real-Time File Retrieval (GET /repos/octocat/Hello-World/contents/README)
  console.log(`\n-------------------------------------------------`);
  console.log(`3. Real API GET: get_file (${owner}/${repo}/README)`);
  console.log(`-------------------------------------------------`);

  const fileRes = await executeGithubOperation(
    { operation: "get_file", owner, repository: repo, path: "README" },
    client
  );
  console.log(fileRes);

  // ── 4. Feature 24 Guardrail & Real Mutation Test ────────────────────────────
  console.log(`\n-------------------------------------------------`);
  console.log(`4. Feature 24 Guardrail Interception Test (create_or_update_file)`);
  console.log(`-------------------------------------------------`);

  const mutationRes = await executeGithubOperation(
    {
      operation: "create_or_update_file",
      owner,
      repository: repo,
      path: "src/test_mutation.ts",
      content: "export const realData = true;",
      message: "Test mutation request",
      branch: "master",
    },
    client
  );
  console.log(mutationRes);

  console.log("\n=================================================");
  console.log("  REAL-TIME GITHUB EXECUTION COMPLETE");
  console.log("=================================================\n");
}

runRealGithubExecution();
