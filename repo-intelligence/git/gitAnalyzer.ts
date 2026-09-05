/**
 * Aegis Repository Intelligence — Git Intelligence Engine
 * 
 * Analyzes Git commit history, timestamps, authors, diff statistics,
 * and identifies co-change file coupling patterns.
 */

import { execSync } from 'child_process';
import path from 'path';
import { GitCommitRecord } from '../types';

export interface AnalyzeGitHistoryInput {
  repoId: string;
  repoPath: string;
  maxCommits?: number; // default 50
}

export interface FileGitStats {
  filePath: string;
  commitCount: number;
  lastModifiedTimestamp: string;
  lastCommitSha: string;
  coChangedFiles: Array<{ filePath: string; coChangeCount: number }>;
}

export async function analyzeGitHistory(input: AnalyzeGitHistoryInput): Promise<{
  commits: GitCommitRecord[];
  fileStats: Record<string, FileGitStats>;
}> {
  const { repoId, repoPath, maxCommits = 50 } = input;
  const absPath = path.resolve(repoPath);

  const commits: GitCommitRecord[] = [];
  const fileStats: Record<string, FileGitStats> = {};

  try {
    // Run git log format command
    const gitCmd = `git log -n ${maxCommits} --name-only --format="COMMIT_START%n%H%n%an%n%ae%n%aI%n%s"`;
    const output = execSync(gitCmd, { cwd: absPath, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });

    const rawCommits = output.split('COMMIT_START\n').filter((block) => block.trim().length > 0);

    for (const block of rawCommits) {
      const lines = block.split(/\r?\n/);
      if (lines.length < 5) continue;

      const sha = lines[0].trim();
      const author = lines[1].trim();
      const email = lines[2].trim();
      const timestamp = lines[3].trim();
      const message = lines[4].trim();

      // Lines after index 5 are modified file paths
      const changedFiles = lines
        .slice(5)
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      const commitId = `commit_${sha.substring(0, 8)}`;
      commits.push({
        id: commitId,
        repoId,
        sha,
        author,
        email,
        timestamp,
        message,
        changedFiles,
        additions: 0,
        deletions: 0,
      });

      // Track file stats & co-change coupling
      for (const filePath of changedFiles) {
        const normPath = filePath.replace(/\\/g, '/');
        if (!fileStats[normPath]) {
          fileStats[normPath] = {
            filePath: normPath,
            commitCount: 0,
            lastModifiedTimestamp: timestamp,
            lastCommitSha: sha,
            coChangedFiles: [],
          };
        }

        const stat = fileStats[normPath];
        stat.commitCount++;

        // Track co-changes
        for (const coPath of changedFiles) {
          const normCo = coPath.replace(/\\/g, '/');
          if (normCo !== normPath) {
            let coEntry = stat.coChangedFiles.find((c) => c.filePath === normCo);
            if (!coEntry) {
              coEntry = { filePath: normCo, coChangeCount: 0 };
              stat.coChangedFiles.push(coEntry);
            }
            coEntry.coChangeCount++;
          }
        }
      }
    }
  } catch {
    // Return empty history cleanly if git is uninitialized or absent
  }

  return { commits, fileStats };
}
