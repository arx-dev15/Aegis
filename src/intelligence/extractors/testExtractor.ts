/**
 * Aegis Repository Intelligence — Test Intelligence Extractor
 * 
 * Identifies unit/integration test files and maps tests to source files and symbols.
 */

import path from 'path';
import { FileRecord, SymbolRecord, TestRecord } from '../types';

export interface ExtractTestsInput {
  repoId: string;
  files: FileRecord[];
  fileContents: Record<string, string>;
  symbols: SymbolRecord[];
}

export function extractTests(input: ExtractTestsInput): TestRecord[] {
  const { repoId, files, fileContents, symbols } = input;
  const testRecords: TestRecord[] = [];
  let testCounter = 1;

  const testFiles = files.filter((f) => f.category === 'TEST');

  for (const testFile of testFiles) {
    const content = fileContents[testFile.path];
    if (!content) continue;

    // Detect test framework (Jest, Vitest, Mocha, etc.)
    let framework = 'Vitest / Jest';
    if (content.includes('import { test } from \'@playwright/test\'')) framework = 'Playwright';
    if (content.includes('cy.visit') || content.includes('cypress')) framework = 'Cypress';

    // Target source file resolution
    const targetSourcePath = inferTargetSourceFilePath(testFile.path, files.map((f) => f.path));
    // Scope target symbols strictly to target source file or symbols imported into test file
    const candidateSymbols = symbols.filter((sym) => {
      if (targetSourcePath && sym.filePath === targetSourcePath) return true;
      if (content.includes(`import`) && content.includes(sym.name) && sym.exported) {
        return true;
      }
      return false;
    });

    // Extract test block names: describe("...", ...) or test("...", ...) or it("...", ...)
    const testBlockRegex = /(?:describe|test|it)\s*\(\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null;

    while ((match = testBlockRegex.exec(content)) !== null) {
      const testName = match[1];
      const targetSymbolIds: string[] = [];

      for (const sym of candidateSymbols) {
        if (sym.name.length > 2 && (testName.includes(sym.name) || new RegExp(`\\b${sym.name}\\b`).test(content))) {
          if (!targetSymbolIds.includes(sym.id)) {
            targetSymbolIds.push(sym.id);
          }
        }
      }

      testRecords.push({
        id: `test_${testFile.id}_${testCounter++}`,
        repoId,
        fileId: testFile.id,
        filePath: testFile.path,
        testName,
        framework,
        targetFilePaths: targetSourcePath ? [targetSourcePath] : [],
        targetSymbolIds,
      });
    }
  }

  return testRecords;
}

function inferTargetSourceFilePath(testFilePath: string, allFilePaths: string[]): string | undefined {
  const normalized = testFilePath.replace(/\\/g, '/');
  const basename = path.basename(normalized);

  // Strip .test. / .spec. / _test
  const sourceName = basename
    .replace(/\.test\.(ts|js|tsx|jsx)$/, '.$1')
    .replace(/\.spec\.(ts|js|tsx|jsx)$/, '.$1');

  if (sourceName === basename) return undefined;

  // Search matching path in workspace
  return allFilePaths.find((p) => {
    const pNorm = p.replace(/\\/g, '/');
    return pNorm.endsWith(`/${sourceName}`) || pNorm === sourceName;
  });
}
