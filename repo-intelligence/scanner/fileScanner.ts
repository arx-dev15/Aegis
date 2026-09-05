/**
 * Aegis Repository Intelligence — File Scanner
 * 
 * Scans repository directories, applies ignore rules (.gitignore + default rules),
 * computes file hashes, lines, sizes, and classifies files into FileRecord entities.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { FileRecord } from '../types';
import { classifyFile } from './classifier';
import { isSecretConfigFile, sanitizeRepositoryContent } from './security';

export interface FileScannerOptions {
  customIgnoreRules?: string[];
  maxFileSizeKb?: number; // default 5000 KB (5MB)
  repoId?: string;
  revision?: string;
}

const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.tmp',
  'dist',
  'build',
  'out',
  'coverage',
  '.cache',
  '.next',
  '.turbo',
  'venv',
  '__pycache__',
  'target',
  '.DS_Store',
  'thumbs.db',
  'package-lock.json.tmp',
];

export function parseGitIgnore(gitignorePath: string): string[] {
  if (!fs.existsSync(gitignorePath)) return [];
  try {
    const raw = fs.readFileSync(gitignorePath, 'utf-8');
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
  } catch {
    return [];
  }
}

export function shouldIgnoreFile(relPath: string, ignorePatterns: string[]): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const filename = parts[parts.length - 1];

  // Secrets filter: .env (except .env.example)
  if (isSecretConfigFile(filename)) {
    return true;
  }

  for (const pattern of ignorePatterns) {
    const cleanPattern = pattern.replace(/^\//, '').replace(/\/$/, '');
    if (parts.includes(cleanPattern) || filename === cleanPattern) {
      return true;
    }
    if (cleanPattern.startsWith('*.') && filename.endsWith(cleanPattern.slice(1))) {
      return true;
    }
  }

  return false;
}

export async function scanRepositoryDirectory(
  rootDirPath: string,
  options?: FileScannerOptions
): Promise<FileRecord[]> {
  const absRootDir = path.resolve(rootDirPath);
  if (!fs.existsSync(absRootDir)) {
    throw new Error(`Directory "${absRootDir}" does not exist.`);
  }

  const repoId = options?.repoId || `repo_scan_${path.basename(absRootDir)}`;
  const revision = options?.revision || 'main';
  const maxSizeBytes = (options?.maxFileSizeKb || 5000) * 1024;

  const gitignorePatterns = parseGitIgnore(path.join(absRootDir, '.gitignore'));
  const ignorePatterns = Array.from(
    new Set([...DEFAULT_IGNORE_PATTERNS, ...(options?.customIgnoreRules || []), ...gitignorePatterns])
  );

  const fileRecords: FileRecord[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(absRootDir, fullPath).replace(/\\/g, '/');

      if (shouldIgnoreFile(relPath, ignorePatterns)) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > maxSizeBytes) {
            // Ignore excessively large files
            continue;
          }

          const rawContent = fs.readFileSync(fullPath, 'utf-8');
          const sanitized = sanitizeRepositoryContent(rawContent);
          
          const hash = crypto.createHash('sha256').update(sanitized.content).digest('hex').substring(0, 16);
          const lines = sanitized.content.split(/\r?\n/).length;
          const classification = classifyFile(relPath);

          const fileId = `file_${crypto.createHash('md5').update(relPath).digest('hex').substring(0, 12)}`;

          fileRecords.push({
            id: fileId,
            repoId,
            path: relPath,
            name: entry.name,
            extension: path.extname(entry.name),
            language: classification.language,
            size: stat.size,
            hash,
            category: classification.category,
            lines,
            revision,
          });
        } catch {
          // Binary or unreadable files produce binary record
          const fileId = `file_${crypto.createHash('md5').update(relPath).digest('hex').substring(0, 12)}`;
          const classification = classifyFile(relPath);
          fileRecords.push({
            id: fileId,
            repoId,
            path: relPath,
            name: entry.name,
            extension: path.extname(entry.name),
            language: classification.language,
            size: 0,
            hash: 'binary_hash',
            category: classification.category === 'UNKNOWN' ? 'BINARY' : classification.category,
            lines: 0,
            revision,
          });
        }
      }
    }
  }

  walk(absRootDir);
  return fileRecords;
}
