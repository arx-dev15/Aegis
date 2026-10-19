/**
 * tools/github/client.ts
 *
 * Feature 25 — GitHub Integration Client
 *
 * Small, typed REST API client built on Node.js native `fetch`.
 * Handles GitHub REST communication, headers, error normalization,
 * base64 file decoding, and strict token masking.
 */

import dotenv from "dotenv";
dotenv.config();

export interface GitHubClientOptions {
  token?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export class GitHubClient {
  private token: string;
  private baseUrl: string;
  private fetch: typeof fetch;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token !== undefined ? options.token : (process.env.GITHUB_TOKEN || "");
    this.baseUrl = (options.baseUrl || "https://api.github.com").replace(/\/+$/, "");
    this.fetch = options.fetchFn || globalThis.fetch;
  }

  /**
   * Helper to ensure token is available before making API requests.
   * Throws a clean configuration error without crashing.
   */
  private checkAuth(): void {
    if (!this.token || this.token.trim() === "") {
      throw new Error("Configuration error: GITHUB_TOKEN environment variable is missing.");
    }
  }

  /**
   * Mask token from error strings to prevent credential exposure.
   */
  private maskSecrets(str: string): string {
    if (!this.token) return str;
    return str.replace(new RegExp(this.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "***TOKEN_HIDDEN***");
  }

  /**
   * Execute authenticated HTTP request to GitHub REST API.
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const isWrite = options.method && options.method.toUpperCase() !== "GET";

    if (isWrite && (!this.token || this.token.trim() === "")) {
      throw new Error("Configuration error: GITHUB_TOKEN environment variable is missing for write operations.");
    }

    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Aegis-Agent-Core",
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token && this.token.trim() !== "") {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    let res: Response;
    try {
      res = await this.fetch(url, {
        ...options,
        headers,
      });
    } catch (err: any) {
      throw new Error(this.maskSecrets(`GitHub network error: unable to connect (${err.message || err}).`));
    }

    if (!res.ok) {
      const status = res.status;
      let errorBody = "";
      try {
        errorBody = await res.text();
      } catch {
        errorBody = res.statusText;
      }

      const maskedBody = this.maskSecrets(errorBody);

      if (status === 401) {
        throw new Error("GitHub API authentication failure (401 Bad credentials or invalid token).");
      }
      if (status === 403) {
        throw new Error(`GitHub API permission or rate-limit error (403 Forbidden): ${maskedBody}`);
      }
      if (status === 404) {
        throw new Error(`GitHub resource not found (404 Not Found): ${cleanEndpoint}`);
      }
      if (status === 409) {
        throw new Error(`GitHub conflict error (409 Conflict): ${maskedBody}`);
      }
      if (status === 422) {
        throw new Error(`GitHub API validation error (422 Unprocessable Entity): ${maskedBody}`);
      }
      if (status === 429) {
        throw new Error("GitHub API rate limit exceeded (429 Too Many Requests).");
      }
      if (status >= 500) {
        throw new Error(`GitHub server error (${status} Internal Error).`);
      }
      throw new Error(`GitHub API error (${status}): ${maskedBody}`);
    }

    try {
      const json = await res.json();
      return json as T;
    } catch (err) {
      throw new Error("GitHub API response parsing error: Expected JSON response.");
    }
  }

  // ── READ OPERATIONS ──────────────────────────────────────────────────────────

  public async getRepository(owner: string, repo: string): Promise<any> {
    const data = await this.request<any>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      owner: data.owner?.login,
      private: data.private,
      description: data.description,
      defaultBranch: data.default_branch,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      url: data.html_url,
    };
  }

  public async listBranches(owner: string, repo: string): Promise<any[]> {
    const data = await this.request<any[]>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`);
    return data.map((b) => ({
      name: b.name,
      protected: b.protected,
      commitSha: b.commit?.sha,
    }));
  }

  public async getBranch(owner: string, repo: string, branch: string): Promise<any> {
    const data = await this.request<any>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`
    );
    return {
      name: data.name,
      protected: data.protected,
      commitSha: data.commit?.sha,
      treeSha: data.commit?.commit?.tree?.sha,
    };
  }

  public async listContents(owner: string, repo: string, path: string = "", ref?: string): Promise<any[]> {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const cleanPath = path.replace(/^\/+/, "");
    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(cleanPath)}${query}`;
    const data = await this.request<any>(endpoint);
    const items = Array.isArray(data) ? data : [data];
    return items.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type, // 'file' | 'dir'
      size: item.size,
      sha: item.sha,
      downloadUrl: item.download_url,
    }));
  }

  public async getFile(owner: string, repo: string, path: string, ref?: string): Promise<any> {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const cleanPath = path.replace(/^\/+/, "");
    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(cleanPath)}${query}`;
    const data = await this.request<any>(endpoint);

    let content = "";
    if (data.encoding === "base64" && data.content) {
      content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
    } else {
      content = data.content || "";
    }

    return {
      name: data.name,
      path: data.path,
      sha: data.sha,
      size: data.size,
      encoding: data.encoding,
      content: content,
    };
  }

  public async listCommits(owner: string, repo: string, ref?: string, limit: number = 10): Promise<any[]> {
    const params = new URLSearchParams();
    if (ref) params.append("sha", ref);
    params.append("per_page", String(Math.min(limit, 100)));

    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params.toString()}`;
    const data = await this.request<any[]>(endpoint);

    return data.map((c) => ({
      sha: c.sha,
      author: c.commit?.author?.name,
      email: c.commit?.author?.email,
      date: c.commit?.author?.date,
      message: c.commit?.message,
    }));
  }

  public async getIssue(owner: string, repo: string, issueNumber: number): Promise<any> {
    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`;
    const data = await this.request<any>(endpoint);
    return {
      number: data.number,
      title: data.title,
      state: data.state,
      user: data.user?.login,
      body: data.body,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      comments: data.comments,
    };
  }

  public async listIssues(owner: string, repo: string, state: string = "open", limit: number = 10): Promise<any[]> {
    const params = new URLSearchParams();
    params.append("state", state);
    params.append("per_page", String(Math.min(limit, 100)));

    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?${params.toString()}`;
    const data = await this.request<any[]>(endpoint);

    return data.map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      user: i.user?.login,
      createdAt: i.created_at,
    }));
  }

  public async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<any> {
    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}`;
    const data = await this.request<any>(endpoint);
    return {
      number: data.number,
      title: data.title,
      state: data.state,
      user: data.user?.login,
      body: data.body,
      head: data.head?.ref,
      base: data.base?.ref,
      mergeable: data.mergeable,
      createdAt: data.created_at,
    };
  }

  public async listPullRequests(owner: string, repo: string, state: string = "open", limit: number = 10): Promise<any[]> {
    const params = new URLSearchParams();
    params.append("state", state);
    params.append("per_page", String(Math.min(limit, 100)));

    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?${params.toString()}`;
    const data = await this.request<any[]>(endpoint);

    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      user: pr.user?.login,
      head: pr.head?.ref,
      base: pr.base?.ref,
      createdAt: pr.created_at,
    }));
  }

  // ── WRITE OPERATIONS ─────────────────────────────────────────────────────────

  public async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string
  ): Promise<any> {
    const cleanPath = path.replace(/^\/+/, "");
    const base64Content = Buffer.from(content, "utf-8").toString("base64");

    const bodyObj: any = {
      message,
      content: base64Content,
      branch,
    };
    if (sha) bodyObj.sha = sha;

    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(cleanPath)}`;
    const data = await this.request<any>(endpoint, {
      method: "PUT",
      body: JSON.stringify(bodyObj),
    });

    return {
      path: data.content?.path,
      sha: data.content?.sha,
      commitSha: data.commit?.sha,
    };
  }

  public async createIssue(owner: string, repo: string, title: string, body?: string): Promise<any> {
    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`;
    const data = await this.request<any>(endpoint, {
      method: "POST",
      body: JSON.stringify({ title, body }),
    });

    return {
      number: data.number,
      title: data.title,
      state: data.state,
      url: data.html_url,
    };
  }

  public async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string | undefined,
    head: string,
    base: string
  ): Promise<any> {
    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`;
    const data = await this.request<any>(endpoint, {
      method: "POST",
      body: JSON.stringify({ title, body, head, base }),
    });

    return {
      number: data.number,
      title: data.title,
      state: data.state,
      url: data.html_url,
      head: data.head?.ref,
      base: data.base?.ref,
    };
  }
}

export const defaultGitHubClient = new GitHubClient();
