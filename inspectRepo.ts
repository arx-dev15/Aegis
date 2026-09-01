/**
 * inspectRepo.ts
 *
 * Aegis Live GitHub Repository Inspector CLI
 *
 * Usage:
 *   npx tsx inspectRepo.ts <owner> <repository>
 *
 * Examples:
 *   npx tsx inspectRepo.ts arx-dev15 Aegis
 *   npx tsx inspectRepo.ts facebook react
 *   npx tsx inspectRepo.ts vercel next.js
 */

import dotenv from "dotenv";
dotenv.config();

import { GitHubClient, executeGithubOperation } from "./tools/github/index.js";

function parseResult(res: any) {
  if (typeof res === "string") {
    try {
      return JSON.parse(res);
    } catch {
      return { raw: res };
    }
  }
  return res;
}

async function inspectUserRepo() {
  const args = process.argv.slice(2);
  const owner = args[0];
  const repository = args[1];

  if (!owner || !repository) {
    console.log("\n=================================================");
    console.log("  AEGIS LIVE GITHUB REPOSITORY INSPECTOR");
    console.log("=================================================");
    console.log("❌ Missing repository parameters!\n");
    console.log("Usage:");
    console.log("  npx tsx inspectRepo.ts <owner> <repository>\n");
    console.log("Examples:");
    console.log("  npx tsx inspectRepo.ts facebook react");
    console.log("  npx tsx inspectRepo.ts vercel next.js");
    console.log("  npx tsx inspectRepo.ts YOUR_GITHUB_USERNAME YOUR_REPO_NAME\n");
    process.exit(1);
  }

  const token = process.env.GITHUB_TOKEN || "";
  const hasToken = Boolean(token && token.trim() !== "");
  const client = new GitHubClient({ token });

  console.log("\n=================================================");
  console.log(`  INSPECTING LIVE GITHUB REPO: ${owner}/${repository}`);
  console.log("=================================================");
  console.log(` Authentication: ${hasToken ? "🔒 AUTHENTICATED (GITHUB_TOKEN present)" : "🌐 PUBLIC READ-ONLY"}\n`);

  // 1. Repository Info
  console.log(`-------------------------------------------------`);
  console.log(`1. Live Repository Metadata`);
  console.log(`-------------------------------------------------`);
  const rawRepo = await executeGithubOperation({ operation: "get_repository", owner, repository }, client);
  const repoRes = parseResult(rawRepo);
  console.log(JSON.stringify(repoRes, null, 2));

  if (!repoRes.allowed || repoRes.error) {
    console.log("\n⚠️ Stopping inspection: Repository could not be fetched or was not found.");
    return;
  }

  // 2. Branches
  console.log(`\n-------------------------------------------------`);
  console.log(`2. Live Branches`);
  console.log(`-------------------------------------------------`);
  const rawBranch = await executeGithubOperation({ operation: "list_branches", owner, repository }, client);
  console.log(JSON.stringify(parseResult(rawBranch), null, 2));

  // 3. Root Files
  console.log(`\n-------------------------------------------------`);
  console.log(`3. Live Root Directory Contents`);
  console.log(`-------------------------------------------------`);
  const rawFiles = await executeGithubOperation({ operation: "list_contents", owner, repository }, client);
  console.log(JSON.stringify(parseResult(rawFiles), null, 2));

  // 4. Commits
  console.log(`\n-------------------------------------------------`);
  console.log(`4. Live Latest Commits`);
  console.log(`-------------------------------------------------`);
  const rawCommits = await executeGithubOperation({ operation: "list_commits", owner, repository, limit: 3 }, client);
  console.log(JSON.stringify(parseResult(rawCommits), null, 2));

  console.log("\n=================================================");
  console.log(`  LIVE INSPECTION COMPLETE FOR ${owner}/${repository}`);
  console.log("=================================================\n");
}

inspectUserRepo();
