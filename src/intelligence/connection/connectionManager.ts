/**
 * Aegis Repository Connection Manager
 * 
 * Manages repository connection validation, identity generation,
 * credential masking, and read-only validation.
 */

import fs from 'fs';
import path from 'path';
import { ConnectionValidationResult, Repository, RepositoryProvider } from '../types';

export interface ParsedRepoUrl {
  provider: RepositoryProvider;
  owner: string;
  name: string;
  url: string;
  cleanUrl: string;
}

export function parseRepositoryUrl(rawUrl: string): ParsedRepoUrl {
  const trimmed = rawUrl.trim();

  // 1. Check if it's a local filesystem path
  if (path.isAbsolute(trimmed) || fs.existsSync(trimmed)) {
    const absPath = path.resolve(trimmed);
    const repoName = path.basename(absPath) || 'local-repo';
    return {
      provider: 'local',
      owner: 'local',
      name: repoName,
      url: absPath,
      cleanUrl: absPath,
    };
  }

  // 2. GitHub HTTPS format: https://github.com/owner/repo or https://github.com/owner/repo.git
  const githubHttpRegex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/i;
  const httpMatch = trimmed.match(githubHttpRegex);
  if (httpMatch) {
    const owner = httpMatch[1];
    const name = httpMatch[2];
    return {
      provider: 'github',
      owner,
      name,
      url: `https://github.com/${owner}/${name}`,
      cleanUrl: `https://github.com/${owner}/${name}`,
    };
  }

  // 3. GitHub SSH format: git@github.com:owner/repo.git
  const githubSshRegex = /^git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/i;
  const sshMatch = trimmed.match(githubSshRegex);
  if (sshMatch) {
    const owner = sshMatch[1];
    const name = sshMatch[2];
    return {
      provider: 'github',
      owner,
      name,
      url: `https://github.com/${owner}/${name}`,
      cleanUrl: `https://github.com/${owner}/${name}`,
    };
  }

  // Fallback / Generic URL
  const sanitizeName = trimmed.split('/').pop()?.replace('.git', '') || 'repository';
  return {
    provider: 'other',
    owner: 'external',
    name: sanitizeName,
    url: trimmed,
    cleanUrl: trimmed,
  };
}

export function maskCredentials(str: string): string {
  if (!str) return str;
  // Mask GitHub tokens (ghp_, gho_, github_pat_, etc.)
  return str
    .replace(/(ghp_[a-zA-Z0-9]{36})/g, 'ghp_****')
    .replace(/(gho_[a-zA-Z0-9]{36})/g, 'gho_****')
    .replace(/(github_pat_[a-zA-Z0-9_]{22,})/g, 'github_pat_****')
    .replace(/(Bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
    .replace(/(:)[^\s"':@]+(@github\.com)/gi, ':[REDACTED]$2');
}

export async function validateRepositoryAccess(
  rawUrl: string,
  options?: { branch?: string; commitSha?: string; token?: string }
): Promise<ConnectionValidationResult> {
  const parsed = parseRepositoryUrl(rawUrl);

  // 1. Local filesystem verification
  if (parsed.provider === 'local') {
    if (!fs.existsSync(parsed.url)) {
      return {
        valid: false,
        error: `Local directory "${parsed.url}" does not exist.`,
      };
    }
    const stat = fs.statSync(parsed.url);
    if (!stat.isDirectory()) {
      return {
        valid: false,
        error: `Path "${parsed.url}" is not a directory.`,
      };
    }

    const repoId = `repo_local_${parsed.name}_${Date.now().toString(36)}`;
    return {
      valid: true,
      readable: true,
      repository: {
        id: repoId,
        provider: 'local',
        owner: 'local',
        name: parsed.name,
        url: parsed.cleanUrl,
        defaultBranch: options?.branch || 'main',
        analyzedRevision: options?.commitSha || 'local-head',
        commitSha: options?.commitSha || 'local-head',
        status: 'pending',
      },
    };
  }

  // 2. GitHub repository validation
  if (parsed.provider === 'github') {
    const apiTarget = `https://api.github.com/repos/${parsed.owner}/${parsed.name}`;
    const headers: Record<string, string> = {
      'User-Agent': 'Aegis-Repository-Intelligence/1.0',
      Accept: 'application/vnd.github.v3+json',
    };

    const authToken = options?.token || process.env.GITHUB_TOKEN;
    if (authToken) {
      headers.Authorization = `token ${authToken}`;
    }

    try {
      const response = await fetch(apiTarget, { headers });
      if (response.status === 404) {
        return {
          valid: false,
          error: `Repository "${parsed.owner}/${parsed.name}" was not found on GitHub or is private.`,
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          valid: false,
          error: `Access denied for repository "${parsed.owner}/${parsed.name}". Please verify authorization.`,
        };
      }
      if (!response.ok) {
        return {
          valid: false,
          error: `GitHub API error (${response.status}): ${response.statusText}`,
        };
      }

      const repoData = (await response.json()) as { default_branch: string };
      const defaultBranch = options?.branch || repoData.default_branch || 'main';

      // If branch specified, verify branch exists
      if (options?.branch) {
        const branchTarget = `https://api.github.com/repos/${parsed.owner}/${parsed.name}/branches/${options.branch}`;
        const branchResp = await fetch(branchTarget, { headers });
        if (branchResp.status === 404) {
          return {
            valid: false,
            error: `The selected branch "${options.branch}" does not exist in repository "${parsed.owner}/${parsed.name}".`,
          };
        }
      }

      // If commitSha specified, verify commit SHA exists
      if (options?.commitSha) {
        const commitTarget = `https://api.github.com/repos/${parsed.owner}/${parsed.name}/commits/${options.commitSha}`;
        const commitResp = await fetch(commitTarget, { headers });
        if (!commitResp.ok) {
          return {
            valid: false,
            error: `The selected commit SHA "${options.commitSha}" was not found in repository "${parsed.owner}/${parsed.name}".`,
          };
        }
      }

      const repoId = `repo_gh_${parsed.owner}_${parsed.name}`;

      return {
        valid: true,
        readable: true,
        repository: {
          id: repoId,
          provider: 'github',
          owner: parsed.owner,
          name: parsed.name,
          url: parsed.cleanUrl,
          defaultBranch,
          analyzedRevision: options?.commitSha || defaultBranch,
          commitSha: options?.commitSha || 'latest',
          status: 'pending',
        },
      };
    } catch (err: any) {
      return {
        valid: false,
        error: `Network/API connection failure: ${maskCredentials(err?.message || String(err))}`,
      };
    }
  }

  return {
    valid: false,
    error: `Unsupported repository provider for URL "${rawUrl}".`,
  };
}

export function createRepositoryIdentity(
  parsed: ParsedRepoUrl,
  options?: { branch?: string; commitSha?: string }
): Repository {
  const now = new Date().toISOString();
  const repoId = `repo_${parsed.provider}_${parsed.owner}_${parsed.name}`.toLowerCase();
  return {
    id: repoId,
    provider: parsed.provider,
    owner: parsed.owner,
    name: parsed.name,
    url: parsed.cleanUrl,
    defaultBranch: options?.branch || 'main',
    analyzedRevision: options?.commitSha || options?.branch || 'main',
    commitSha: options?.commitSha || 'latest',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}
