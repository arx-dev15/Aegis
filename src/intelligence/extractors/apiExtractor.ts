/**
 * Aegis Repository Intelligence — API Route Extractor
 * 
 * Detects HTTP API endpoints, methods, paths, and handler symbols
 * from Express routing patterns and Next.js route handlers.
 */

import { ApiRecord, FileRecord, SymbolRecord } from '../types';

export interface ExtractApisInput {
  repoId: string;
  files: FileRecord[];
  fileContents: Record<string, string>;
  symbols: SymbolRecord[];
}

export function extractApiRoutes(input: ExtractApisInput): ApiRecord[] {
  const { repoId, files, fileContents, symbols } = input;
  const apiRecords: ApiRecord[] = [];
  let apiCounter = 1;

  for (const file of files) {
    if (file.category !== 'SOURCE') continue;
    const content = fileContents[file.path];
    if (!content) continue;

    // 1. Next.js App Router Route Handler Detection (e.g. app/api/projects/route.ts)
    if (file.path.replace(/\\/g, '/').includes('/api/') && file.name.startsWith('route.')) {
      const routePath = deriveNextJsApiRoutePath(file.path);
      const fileSymbols = symbols.filter((s) => s.fileId === file.id);

      const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      for (const method of httpMethods) {
        const handlerSym = fileSymbols.find((s) => s.name === method);
        if (handlerSym || content.includes(`export async function ${method}`)) {
          apiRecords.push({
            id: `api_${file.id}_${apiCounter++}`,
            repoId,
            fileId: file.id,
            filePath: file.path,
            method: method as any,
            path: routePath,
            handlerName: handlerSym ? `${file.name}:${method}` : method,
            handlerSymbolId: handlerSym?.id,
            confidence: 'exact',
          });
        }
      }
    }

    // 2. Express Route Detection (e.g. router.post('/login', authController.login))
    const expressRegex = /(?:router|app)\.(get|post|put|patch|delete|use|all)\s*\(\s*["']([^"']+)["']\s*,\s*([^,\)]+)/gi;
    let match: RegExpExecArray | null;

    while ((match = expressRegex.exec(content)) !== null) {
      const rawMethod = match[1].toUpperCase();
      const routePath = match[2];
      const handlerExpr = match[3].trim();

      if (rawMethod === 'USE' && !routePath.startsWith('/')) continue;

      const method = rawMethod === 'USE' || rawMethod === 'ALL' ? 'ALL' : (rawMethod as any);
      
      // Match handler symbol from extracted symbols
      const handlerName = handlerExpr.split('.').pop() || handlerExpr;
      const matchingSymbol = symbols.find(
        (s) => s.repoId === repoId && (s.name === handlerName || s.name === handlerExpr)
      );

      const confidence = matchingSymbol ? 'exact' : handlerExpr.includes('(') ? 'unresolved' : 'inferred';

      apiRecords.push({
        id: `api_${file.id}_${apiCounter++}`,
        repoId,
        fileId: file.id,
        filePath: file.path,
        method,
        path: routePath,
        handlerName: handlerExpr,
        handlerSymbolId: matchingSymbol?.id,
        confidence,
      });
    }
  }

  return apiRecords;
}

function deriveNextJsApiRoutePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const apiIndex = normalized.indexOf('/api/');
  if (apiIndex === -1) return '/api';

  const routeSubpath = normalized.substring(apiIndex);
  return routeSubpath.replace(/\/route\.(ts|js|tsx|jsx)$/, '');
}
