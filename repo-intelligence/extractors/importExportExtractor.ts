/**
 * Aegis Repository Intelligence — Import/Export Extractor
 * 
 * Extracts import and export statements from TS/JS code and resolves relative
 * module import specifiers to target file paths in the workspace.
 */

import path from 'path';
import { getTypeScriptCompiler } from '../parsers/tsCompilerLoader';
import { ImportExportRecord } from '../types';

export interface ExtractImportExportsInput {
  repoId: string;
  fileId: string;
  filePath: string;
  content: string;
  allFilePaths: string[]; // List of all relative file paths in workspace for exact resolution
}

export function extractImportExports(input: ExtractImportExportsInput): ImportExportRecord[] {
  const { repoId, fileId, filePath, content, allFilePaths } = input;
  if (!content || !content.trim()) return [];

  const ts = getTypeScriptCompiler();
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const records: ImportExportRecord[] = [];
  let recordCounter = 1;

  function getLineNumber(pos: number): number {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  ts.forEachChild(sourceFile, (node) => {
    // 1. IMPORT DECLARATION: import { AuthService } from '../services/auth.service'
    if (ts.isImportDeclaration(node)) {
      const line = getLineNumber(node.getStart(sourceFile));
      const moduleSpecifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
      const symbols: string[] = [];

      if (node.importClause) {
        if (node.importClause.name) {
          // Default import: import Express from 'express'
          symbols.push(node.importClause.name.getText(sourceFile));
        }
        if (node.importClause.namedBindings) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            // Named imports: import { login, logout } from '...'
            for (const element of node.importClause.namedBindings.elements) {
              symbols.push(element.name.getText(sourceFile));
            }
          } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
            // Namespace import: import * as fs from 'fs'
            symbols.push(node.importClause.namedBindings.name.getText(sourceFile));
          }
        }
      }

      const resolvedFilePath = resolveRelativeImportPath(filePath, moduleSpecifier, allFilePaths);

      records.push({
        id: `imp_${fileId}_${recordCounter++}`,
        repoId,
        fileId,
        filePath,
        type: 'import',
        moduleSpecifier,
        resolvedFilePath,
        symbols,
        line,
      });
    }

    // 2. EXPORT DECLARATION: export { AuthService } or export * from '...'
    if (ts.isExportDeclaration(node)) {
      const line = getLineNumber(node.getStart(sourceFile));
      const moduleSpecifier = node.moduleSpecifier
        ? node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '')
        : filePath;
      const symbols: string[] = [];

      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          symbols.push(element.name.getText(sourceFile));
        }
      } else {
        symbols.push('*');
      }

      const resolvedFilePath = node.moduleSpecifier
        ? resolveRelativeImportPath(filePath, moduleSpecifier, allFilePaths)
        : filePath;

      records.push({
        id: `exp_${fileId}_${recordCounter++}`,
        repoId,
        fileId,
        filePath,
        type: 'export',
        moduleSpecifier,
        resolvedFilePath,
        symbols,
        line,
      });
    }
  });

  return records;
}

export function resolveRelativeImportPath(
  currentFilePath: string,
  importSpecifier: string,
  allFilePaths: string[]
): string | undefined {
  // External package import (e.g. 'express', 'zod', 'pg')
  if (!importSpecifier.startsWith('.') && !importSpecifier.startsWith('/')) {
    return undefined;
  }

  const normalizedCurrent = currentFilePath.replace(/\\/g, '/');
  const currentDir = path.dirname(normalizedCurrent);
  const rawResolved = path.posix.normalize(path.posix.join(currentDir, importSpecifier));

  // Try exact match
  if (allFilePaths.includes(rawResolved)) return rawResolved;

  // Try appending extensions (.ts, .tsx, .js, .jsx)
  const candidateExts = ['.ts', '.tsx', '.js', '.jsx', '.d.ts'];
  for (const ext of candidateExts) {
    const withExt = `${rawResolved}${ext}`;
    if (allFilePaths.includes(withExt)) return withExt;
  }

  // Try index files (e.g., dir/index.ts)
  for (const ext of candidateExts) {
    const indexFile = `${rawResolved}/index${ext}`;
    if (allFilePaths.includes(indexFile)) return indexFile;
  }

  return rawResolved;
}
