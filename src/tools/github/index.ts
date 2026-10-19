/**
 * tools/github/index.ts
 *
 * Feature 25 — GitHub Tool Implementation
 *
 * Exposes explicit GitHub operations (10 Read, 3 Write) to Aegis agents via Zod schemas,
 * enforces Feature 24 guardrail security checks BEFORE any network request is made,
 * and delegates to GitHubClient.
 */

import { z } from "zod";
import { createAegisTool } from "../types.js";
import { GitHubClient, defaultGitHubClient } from "./client.js";
import { enforceToolGuardrail } from "../guardrails/index.js";

// ── Discriminated Zod Input Schema ───────────────────────────────────────────

export const GithubInputSchema = z.object({
  operation: z.enum([
    "get_repository",
    "list_branches",
    "get_branch",
    "list_contents",
    "get_file",
    "list_commits",
    "get_issue",
    "list_issues",
    "get_pull_request",
    "list_pull_requests",
    "create_or_update_file",
    "create_issue",
    "create_pull_request",
  ]).describe("The GitHub operation to perform"),

  owner: z.string().min(1).describe("GitHub repository owner (user or organization)"),
  repository: z.string().min(1).describe("GitHub repository name"),

  branch: z.string().optional().describe("Branch name for branch/content operations"),
  path: z.string().optional().describe("File or directory path inside repository"),
  ref: z.string().optional().describe("Git reference (commit SHA, branch, or tag)"),
  limit: z.number().optional().describe("Maximum number of items to return"),
  state: z.string().optional().describe("Filter state for issues/PRs ('open', 'closed', 'all')"),
  issue_number: z.number().optional().describe("Issue number"),
  pull_number: z.number().optional().describe("Pull request number"),

  content: z.string().optional().describe("File content for file create/update operations"),
  message: z.string().optional().describe("Commit message for file create/update operations"),
  sha: z.string().optional().describe("Existing file blob SHA for updating files"),
  title: z.string().optional().describe("Title for issues or pull requests"),
  body: z.string().optional().describe("Body description for issues or pull requests"),
  head: z.string().optional().describe("Head branch for pull request creation"),
  base: z.string().optional().describe("Base branch for pull request creation"),
});

export type GithubInput = z.infer<typeof GithubInputSchema>;

/**
  * Core execution function for GitHub tool requests.
  * Enforces Feature 24 Guardrails BEFORE calling GitHubClient API methods.
  */
export async function executeGithubOperation(
  input: GithubInput,
  client: GitHubClient = defaultGitHubClient
): Promise<string> {
  const { operation, owner, repository } = input;
  const target = `${owner}/${repository}${input.path ? `/${input.path}` : ""}`;

  // ── FEATURE 24 GUARDRAIL ENFORCEMENT ───────────────────────────────────────
  const guard = enforceToolGuardrail({
    toolName: "github",
    action: operation,
    target: target,
  });

  if (!guard.allowed) {
    return JSON.stringify({
      allowed: false,
      status: guard.decision,
      error: `[GUARDRAIL-INTERCEPTED] ${guard.reason}`,
      code: guard.code || "ERR_PERMISSION_DENIED",
      approvalRequest: guard.approvalRequest || null,
    });
  }

  // ── ROUTING TO GITHUB CLIENT ────────────────────────────────────────────────
  try {
    let result: any;

    switch (operation) {
      case "get_repository":
        result = await client.getRepository(owner, repository);
        break;
      case "list_branches":
        result = await client.listBranches(owner, repository);
        break;
      case "get_branch":
        if (!input.branch) throw new Error("Input validation error: 'branch' parameter is required for get_branch.");
        result = await client.getBranch(owner, repository, input.branch);
        break;
      case "list_contents":
        result = await client.listContents(owner, repository, input.path || "", input.ref);
        break;
      case "get_file":
        if (!input.path) throw new Error("Input validation error: 'path' parameter is required for get_file.");
        result = await client.getFile(owner, repository, input.path, input.ref);
        break;
      case "list_commits":
        result = await client.listCommits(owner, repository, input.ref, input.limit || 10);
        break;
      case "get_issue":
        if (!input.issue_number) throw new Error("Input validation error: 'issue_number' parameter is required for get_issue.");
        result = await client.getIssue(owner, repository, input.issue_number);
        break;
      case "list_issues":
        result = await client.listIssues(owner, repository, input.state || "open", input.limit || 10);
        break;
      case "get_pull_request":
        if (!input.pull_number) throw new Error("Input validation error: 'pull_number' parameter is required for get_pull_request.");
        result = await client.getPullRequest(owner, repository, input.pull_number);
        break;
      case "list_pull_requests":
        result = await client.listPullRequests(owner, repository, input.state || "open", input.limit || 10);
        break;

      // Mutation Operations
      case "create_or_update_file":
        if (!input.path) throw new Error("Input validation error: 'path' is required for create_or_update_file.");
        if (input.content === undefined) throw new Error("Input validation error: 'content' is required for create_or_update_file.");
        if (!input.message) throw new Error("Input validation error: 'message' is required for create_or_update_file.");
        if (!input.branch) throw new Error("Input validation error: 'branch' is required for create_or_update_file.");
        result = await client.createOrUpdateFile(
          owner,
          repository,
          input.path,
          input.content,
          input.message,
          input.branch,
          input.sha
        );
        break;
      case "create_issue":
        if (!input.title) throw new Error("Input validation error: 'title' is required for create_issue.");
        result = await client.createIssue(owner, repository, input.title, input.body);
        break;
      case "create_pull_request":
        if (!input.title) throw new Error("Input validation error: 'title' is required for create_pull_request.");
        if (!input.head) throw new Error("Input validation error: 'head' branch is required for create_pull_request.");
        if (!input.base) throw new Error("Input validation error: 'base' branch is required for create_pull_request.");
        result = await client.createPullRequest(owner, repository, input.title, input.body, input.head, input.base);
        break;
      default:
        throw new Error(`Unsupported GitHub operation: ${operation}`);
    }

    return JSON.stringify({
      allowed: true,
      operation,
      owner,
      repository,
      data: result,
    }, null, 2);
  } catch (err: any) {
    return JSON.stringify({
      allowed: true,
      operation,
      error: err.message || "GitHub API execution error",
    });
  }
}

/**
  * LangChain-compatible GitHub Tool for Aegis agents.
  */
export const githubTool = createAegisTool(
  (input: GithubInput) => executeGithubOperation(input),
  {
    name: "github",
    description:
      "Controlled GitHub repository integration tool for reading metadata, branches, contents, files, commits, issues, and PRs, and creating files/issues/PRs.",
    schema: GithubInputSchema,
  }
);

export * from "./client.js";
