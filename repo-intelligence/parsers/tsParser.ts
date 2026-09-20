/**
 * Aegis Repository Intelligence — TypeScript/JavaScript AST Parser
 * 
 * Uses official TypeScript compiler API to deterministically parse AST and extract symbols
 * (Classes, Interfaces, Types, Enums, Functions, Methods, Components, Variables, Constants),
 * including class heritage (extends/implements) and function call expressions with line numbers.
 */

import { SymbolKind, SymbolParameter, SymbolRecord } from '../types';
import { getTypeScriptCompiler } from './tsCompilerLoader';

export interface ParseSymbolsInput {
  repoId: string;
  fileId: string;
  filePath: string;
  content: string;
  language: string;
}

export function parseTypeScriptSymbols(input: ParseSymbolsInput): SymbolRecord[] {
  const { repoId, fileId, filePath, content, language } = input;
  if (!content || !content.trim()) return [];

  const ts = getTypeScriptCompiler();
  const scriptKind = getScriptKind(ts, filePath);

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );

  const symbols: SymbolRecord[] = [];

  function getLineNumber(pos: number): number {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function isExportedNode(node: any): boolean {
    if (!ts.canHaveModifiers(node)) return false;
    const modifiers = ts.getModifiers(node);
    return Boolean(modifiers?.some((m: any) => m.kind === ts.SyntaxKind.ExportKeyword));
  }

  function getVisibility(node: any): 'public' | 'private' | 'protected' | undefined {
    if (!ts.canHaveModifiers(node)) return undefined;
    const modifiers = ts.getModifiers(node);
    if (modifiers?.some((m: any) => m.kind === ts.SyntaxKind.PrivateKeyword)) return 'private';
    if (modifiers?.some((m: any) => m.kind === ts.SyntaxKind.ProtectedKeyword)) return 'protected';
    if (modifiers?.some((m: any) => m.kind === ts.SyntaxKind.PublicKeyword)) return 'public';
    return undefined;
  }

  function parseParameters(params?: any): SymbolParameter[] {
    if (!params) return [];
    return params.map((p: any) => ({
      name: p.name.getText(sourceFile),
      type: p.type ? p.type.getText(sourceFile) : undefined,
      optional: Boolean(p.questionToken),
    }));
  }

  function parseHeritage(node: any): { extendsClause?: string; implementsClause?: string[] } {
    if (!node.heritageClauses) return {};
    let extendsClause: string | undefined;
    const implementsClause: string[] = [];

    for (const clause of node.heritageClauses) {
      if (clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types?.length > 0) {
        extendsClause = clause.types[0].expression.getText(sourceFile);
      }
      if (clause.token === ts.SyntaxKind.ImplementsKeyword && clause.types) {
        for (const type of clause.types) {
          implementsClause.push(type.expression.getText(sourceFile));
        }
      }
    }
    return { extendsClause, implementsClause: implementsClause.length > 0 ? implementsClause : undefined };
  }

  function parseCallExpressions(node: any): Array<{ targetName: string; line: number }> {
    const calls: Array<{ targetName: string; line: number }> = [];

    function findCalls(n: any) {
      if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
        const expr = n.expression;
        let callName: string | undefined;

        if (ts.isPropertyAccessExpression(expr)) {
          callName = `${expr.expression.getText(sourceFile)}.${expr.name.getText(sourceFile)}`;
        } else if (ts.isIdentifier(expr)) {
          callName = expr.getText(sourceFile);
        }

        if (callName) {
          const line = getLineNumber(n.getStart(sourceFile));
          calls.push({ targetName: callName, line });
        }
      }
      ts.forEachChild(n, findCalls);
    }

    ts.forEachChild(node, findCalls);
    return calls;
  }

  function visit(node: any, parentSymbolId?: string) {
    const startLine = getLineNumber(node.getStart(sourceFile));
    const endLine = getLineNumber(node.getEnd());

    // 1. CLASS DECLARATIONS
    if (ts.isClassDeclaration(node) && node.name) {
      const name = node.name.getText(sourceFile);
      const symbolId = `sym_${fileId}_${name}_${startLine}`;
      const exported = isExportedNode(node);
      const { extendsClause, implementsClause } = parseHeritage(node);

      symbols.push({
        id: symbolId,
        repoId,
        fileId,
        filePath,
        name,
        kind: 'class',
        startLine,
        endLine,
        parentSymbolId,
        exported,
        visibility: 'public',
        language,
        extendsClause,
        implementsClause,
      });

      // Visit class members
      ts.forEachChild(node, (child) => visit(child, symbolId));
      return;
    }

    // 2. INTERFACE DECLARATIONS
    if (ts.isInterfaceDeclaration(node)) {
      const name = node.name.getText(sourceFile);
      const symbolId = `sym_${fileId}_${name}_${startLine}`;
      const exported = isExportedNode(node);
      const { extendsClause } = parseHeritage(node);

      symbols.push({
        id: symbolId,
        repoId,
        fileId,
        filePath,
        name,
        kind: 'interface',
        startLine,
        endLine,
        parentSymbolId,
        exported,
        language,
        extendsClause,
      });

      ts.forEachChild(node, (child) => visit(child, symbolId));
      return;
    }

    // 3. TYPE ALIAS DECLARATIONS
    if (ts.isTypeAliasDeclaration(node)) {
      const name = node.name.getText(sourceFile);
      const symbolId = `sym_${fileId}_${name}_${startLine}`;
      const exported = isExportedNode(node);

      symbols.push({
        id: symbolId,
        repoId,
        fileId,
        filePath,
        name,
        kind: 'type',
        startLine,
        endLine,
        parentSymbolId,
        exported,
        language,
      });
      return;
    }

    // 4. ENUM DECLARATIONS
    if (ts.isEnumDeclaration(node)) {
      const name = node.name.getText(sourceFile);
      const symbolId = `sym_${fileId}_${name}_${startLine}`;
      const exported = isExportedNode(node);

      symbols.push({
        id: symbolId,
        repoId,
        fileId,
        filePath,
        name,
        kind: 'enum',
        startLine,
        endLine,
        parentSymbolId,
        exported,
        language,
      });
      return;
    }

    // 5. METHOD DECLARATIONS
    if (ts.isMethodDeclaration(node) && parentSymbolId) {
      const name = node.name.getText(sourceFile);
      const symbolId = `sym_${fileId}_${name}_${startLine}`;
      const visibility = getVisibility(node) || 'public';
      const parameters = parseParameters(node.parameters);
      const returnType = node.type ? node.type.getText(sourceFile) : undefined;
      const calls = parseCallExpressions(node);

      symbols.push({
        id: symbolId,
        repoId,
        fileId,
        filePath,
        name,
        kind: 'method',
        startLine,
        endLine,
        parentSymbolId,
        exported: isExportedNode(node),
        visibility,
        parameters,
        returnType,
        language,
        calls,
      });
      return;
    }

    // 6. FUNCTION DECLARATIONS
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.getText(sourceFile);
      const symbolId = `sym_${fileId}_${name}_${startLine}`;
      const exported = isExportedNode(node);
      const parameters = parseParameters(node.parameters);
      const returnType = node.type ? node.type.getText(sourceFile) : undefined;
      const calls = parseCallExpressions(node);

      const isComponent = (language === 'TSX' || language === 'JSX') && /^[A-Z]/.test(name);
      const kind: SymbolKind = isComponent ? 'component' : 'function';

      symbols.push({
        id: symbolId,
        repoId,
        fileId,
        filePath,
        name,
        kind,
        startLine,
        endLine,
        parentSymbolId,
        exported,
        visibility: 'public',
        parameters,
        returnType,
        language,
        calls,
      });
      return;
    }

    // 7. VARIABLE / CONSTANT DECLARATIONS
    if (ts.isVariableStatement(node)) {
      const exported = isExportedNode(node);
      const isConst = (node.declarationList.flags & ts.NodeFlags.Const) !== 0;

      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const name = decl.name.getText(sourceFile);
          const symbolId = `sym_${fileId}_${name}_${startLine}`;
          const isComponent = (language === 'TSX' || language === 'JSX') && /^[A-Z]/.test(name);
          const kind: SymbolKind = isComponent ? 'component' : isConst ? 'constant' : 'variable';
          const calls = parseCallExpressions(decl);

          symbols.push({
            id: symbolId,
            repoId,
            fileId,
            filePath,
            name,
            kind,
            startLine,
            endLine,
            parentSymbolId,
            exported,
            language,
            calls,
          });
        }
      }
      return;
    }

    ts.forEachChild(node, (child) => visit(child, parentSymbolId));
  }

  ts.forEachChild(sourceFile, (node) => visit(node));
  return symbols;
}

function getScriptKind(ts: typeof import('typescript'), filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx':
      return ts.ScriptKind.TSX;
    case 'jsx':
      return ts.ScriptKind.JSX;
    case 'js':
    case 'mjs':
    case 'cjs':
      return ts.ScriptKind.JS;
    case 'ts':
    default:
      return ts.ScriptKind.TS;
  }
}
