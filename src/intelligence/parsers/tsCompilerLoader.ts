/**
 * Aegis Repository Intelligence — TypeScript Compiler Loader
 * 
 * Safely resolves the standard TypeScript compiler API across workspace node_modules.
 */

import path from 'path';

let tsInstance: any = null;

export function getTypeScriptCompiler(): any {
  if (tsInstance) return tsInstance;

  try {
    const defaultTs = require('typescript');
    if (defaultTs && typeof defaultTs.createSourceFile === 'function') {
      tsInstance = defaultTs;
      return tsInstance;
    }
  } catch {}

  // Candidates relative to codebase and active cwd
  const candidates = [
    path.resolve(__dirname, '../../../apps/api/node_modules/typescript'),
    path.resolve(__dirname, '../../../apps/web/node_modules/typescript'),
    path.resolve(__dirname, '../../../node_modules/typescript'),
    path.resolve(process.cwd(), 'apps/api/node_modules/typescript'),
    path.resolve(process.cwd(), 'node_modules/typescript'),
  ];

  for (const candidate of candidates) {
    try {
      const candidateTs = require(candidate);
      if (candidateTs && typeof candidateTs.createSourceFile === 'function') {
        tsInstance = candidateTs;
        return tsInstance;
      }
    } catch {}
  }

  throw new Error('TypeScript compiler API could not be loaded. Please ensure typescript is installed.');
}
