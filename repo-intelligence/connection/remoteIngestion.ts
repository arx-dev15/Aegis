/**
 * Aegis Repository Intelligence — Remote Repository Ingestion Manager
 * 
 * Safely downloads or clones remote repositories (GitHub HTTPS/SSH) into an isolated
 * temporary workspace for analysis, and provides automatic cleanup routines.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface RemoteIngestionInput {
  url: string;
  owner: string;
  name: string;
  branch?: string;
  commitSha?: string;
  token?: string;
}

export interface RemoteIngestionOutput {
  localPath: string;
  commitSha: string;
  cleanup: () => void;
}

export async function ingestRemoteRepository(input: RemoteIngestionInput): Promise<RemoteIngestionOutput> {
  const { url, owner, name, branch = 'main', commitSha, token } = input;

  const tmpBaseDir = path.resolve(process.cwd(), '.tmp', 'repo_ingest');
  if (!fs.existsSync(tmpBaseDir)) {
    fs.mkdirSync(tmpBaseDir, { recursive: true });
  }

  const timestamp = Date.now().toString(36);
  const targetDir = path.join(tmpBaseDir, `${owner}_${name}_${timestamp}`);

  let authedUrl = url;
  if (token) {
    authedUrl = `https://${token}@github.com/${owner}/${name}.git`;
  } else if (!url.endsWith('.git')) {
    authedUrl = `${url}.git`;
  }

  let finalSha = commitSha || 'HEAD';

  try {
    // Attempt git clone with --depth 1
    const cloneCmd = `git clone --depth 1 ${branch ? `--branch "${branch}"` : ''} "${authedUrl}" "${targetDir}"`;
    execSync(cloneCmd, { stdio: 'pipe', timeout: 60000 });

    try {
      finalSha = execSync(`git rev-parse HEAD`, { cwd: targetDir, stdio: 'pipe' }).toString().trim();
    } catch {}

    const cleanup = () => {
      try {
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
      } catch {}
    };

    return {
      localPath: targetDir,
      commitSha: finalSha,
      cleanup,
    };
  } catch (err: any) {
    // If git clone failed, try downloading tarball from GitHub REST API
    try {
      const archiveUrl = `https://api.github.com/repos/${owner}/${name}/tarball/${branch}`;
      const headers: Record<string, string> = {
        'User-Agent': 'Aegis-Repository-Intelligence/1.0',
        Accept: 'application/vnd.github.v3+json',
      };
      if (token) headers.Authorization = `token ${token}`;

      const response = await fetch(archiveUrl, { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // If tarball download succeeded, extract it
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const tarPath = path.join(tmpBaseDir, `${owner}_${name}_${timestamp}.tar.gz`);
      fs.writeFileSync(tarPath, buffer);

      fs.mkdirSync(targetDir, { recursive: true });
      execSync(`tar -xzf "${tarPath}" -C "${targetDir}" --strip-components 1`, { stdio: 'pipe' });

      try {
        fs.unlinkSync(tarPath);
      } catch {}

      const cleanup = () => {
        try {
          if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
          }
        } catch {}
      };

      return {
        localPath: targetDir,
        commitSha: finalSha,
        cleanup,
      };
    } catch (tarErr: any) {
      // Clean up targetDir if partially created
      if (fs.existsSync(targetDir)) {
        try {
          fs.rmSync(targetDir, { recursive: true, force: true });
        } catch {}
      }
      throw new Error(`Remote repository ingestion failed for "${owner}/${name}": Unable to clone or download repository archive. Verify repository URL and authentication token.`);
    }
  }
}
