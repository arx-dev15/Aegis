/**
 * Aegis Repository Intelligence — TypeScript Compiler Loader
 * 
 * Safely resolves the standard TypeScript compiler API across workspace node_modules.
 */

import path from 'path';

let tsInstance: typeof import('typescript') | null = null;

export function getTypeScriptCompiler(): typeof import('typescript') {
  if (tsInstance) return tsInstance;

  try {
    const defaultTs = require('typescript');
    if (defaultTs && typeof defaultTs.createSourceFile === 'function') {
      tsInstance = defaultTs;
      return tsInstance;
    }
  } catch {}

  // Fallback to workspace apps/api/node_modules/typescript or local resolve
  try {
    const apiTsPath = path.resolve(process.cwd(), 'apps', 'api', 'node_modules', 'typescript');
    const apiTs = require(apiTsPath);
    if (apiTs && typeof apiTs.createSourceFile === 'function') {
      tsInstance = apiTs;
      return tsInstance;
    }
  } catch {}

  // Fallback to apps/web/node_modules/typescript
  try {
    const webTsPath = path.resolve(process.cwd(), 'apps', 'web', 'node_modules', 'typescript');
    const webTs = require(webTsPath);
    if (webTs && typeof webTs.createSourceFile === 'function') {
      tsInstance = webTs;
      return tsInstance;
    }
  } catch {}

  throw new Error('TypeScript compiler API could not be loaded. Please ensure typescript is installed.');
}
