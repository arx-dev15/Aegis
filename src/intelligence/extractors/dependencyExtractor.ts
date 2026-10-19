/**
 * Aegis Repository Intelligence — Dependency & Monorepo Extractor
 * 
 * Inspects package.json manifests and lockfiles to extract dependencies,
 * package managers, and monorepo workspace boundaries.
 */

import { DependencyRecord, FileRecord } from '../types';

export interface ExtractDependenciesInput {
  repoId: string;
  files: FileRecord[];
  fileContents: Record<string, string>; // path -> content
}

export function extractDependencies(input: ExtractDependenciesInput): DependencyRecord[] {
  const { repoId, files, fileContents } = input;
  const dependencies: DependencyRecord[] = [];
  let depCounter = 1;

  // Find all package.json files
  const packageJsonFiles = files.filter(
    (f) => f.category === 'CONFIG' && f.name.toLowerCase() === 'package.json'
  );

  // Detect package manager from lockfiles
  let packageManager = 'npm';
  if (files.some((f) => f.name === 'yarn.lock')) packageManager = 'yarn';
  if (files.some((f) => f.name === 'pnpm-lock.yaml')) packageManager = 'pnpm';

  // Identify workspace packages if monorepo
  const workspacePackageNames = new Set<string>();
  for (const pkgFile of packageJsonFiles) {
    const content = fileContents[pkgFile.path];
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.name) workspacePackageNames.add(parsed.name);
      } catch {}
    }
  }

  for (const pkgFile of packageJsonFiles) {
    const content = fileContents[pkgFile.path];
    if (!content) continue;

    try {
      const manifest = JSON.parse(content);

      // Runtime dependencies
      if (manifest.dependencies) {
        for (const [name, version] of Object.entries(manifest.dependencies)) {
          const isWorkspace = workspacePackageNames.has(name) || (version as string).startsWith('workspace:');
          dependencies.push({
            id: `dep_${pkgFile.id}_${depCounter++}`,
            repoId,
            name,
            version: String(version),
            type: isWorkspace ? 'workspace' : 'runtime',
            packageManager,
            manifestPath: pkgFile.path,
          });
        }
      }

      // Dev dependencies
      if (manifest.devDependencies) {
        for (const [name, version] of Object.entries(manifest.devDependencies)) {
          const isWorkspace = workspacePackageNames.has(name) || (version as string).startsWith('workspace:');
          dependencies.push({
            id: `dep_${pkgFile.id}_${depCounter++}`,
            repoId,
            name,
            version: String(version),
            type: isWorkspace ? 'workspace' : 'dev',
            packageManager,
            manifestPath: pkgFile.path,
          });
        }
      }
    } catch {}
  }

  return dependencies;
}
