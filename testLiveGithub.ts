/**
 * testLiveGithub.ts
 *
 * Real-Time Dynamic GitHub API Execution Test
 *
 * Performs actual live HTTP requests against api.github.com
 */

import dotenv from "dotenv";
dotenv.config();

import { GitHubClient, executeGithubOperation } from "./tools/github/index.js";

async function runLive() {
  const token = process.env.GITHUB_TOKEN || "";
  const client = new GitHubClient({ token });

  console.log("=================================================");
  console.log("  AEGIS LIVE REAL-TIME GITHUB EXECUTION TEST");
  console.log("=================================================");

  // 1. Live get_repository on octocat/Hello-World
  console.log("\n📡 Sending real-time HTTP GET to https://api.github.com/repos/octocat/Hello-World...");
  try {
    const res1 = await executeGithubOperation(
      { operation: "get_repository", owner: "octocat", repository: "Hello-World" },
      client
    );
    console.log("Response from api.github.com:");
    console.log(res1);
  } catch (err: any) {
    console.log("Error:", err.message);
  }

  // 2. Live list_branches on octocat/Hello-World
  console.log("\n📡 Sending real-time HTTP GET to https://api.github.com/repos/octocat/Hello-World/branches...");
  try {
    const res2 = await executeGithubOperation(
      { operation: "list_branches", owner: "octocat", repository: "Hello-World" },
      client
    );
    console.log("Response from api.github.com:");
    console.log(res2);
  } catch (err: any) {
    console.log("Error:", err.message);
  }

  // 3. Live get_file (README.md) on octocat/Hello-World
  console.log("\n📡 Sending real-time HTTP GET to https://api.github.com/repos/octocat/Hello-World/contents/README...");
  try {
    const res3 = await executeGithubOperation(
      { operation: "get_file", owner: "octocat", repository: "Hello-World", path: "README" },
      client
    );
    console.log("Response from api.github.com:");
    console.log(res3);
  } catch (err: any) {
    console.log("Error:", err.message);
  }
}

runLive();
