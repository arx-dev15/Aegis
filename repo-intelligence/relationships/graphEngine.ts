/**
 * Aegis Repository Intelligence — Relationship Graph Engine
 * 
 * Synthesizes typed relationship edges across files, symbols, APIs, database models,
 * tests, and dependencies with line-level evidence provenance and confidence ratings.
 */

import {
  ApiRecord,
  DatabaseRecord,
  EvidenceRecord,
  FileRecord,
  ImportExportRecord,
  RelationshipRecord,
  RelationshipType,
  SymbolRecord,
  TestRecord,
} from '../types';

export interface BuildGraphInput {
  repoId: string;
  files: FileRecord[];
  symbols: SymbolRecord[];
  importsExports: ImportExportRecord[];
  apis: ApiRecord[];
  databases: DatabaseRecord[];
  tests: TestRecord[];
  fileContents?: Record<string, string>;
}

export function buildRelationshipGraph(input: BuildGraphInput): RelationshipRecord[] {
  const { repoId, files, symbols, importsExports, apis, databases, tests, fileContents } = input;
  const relationships: RelationshipRecord[] = [];
  let relCounter = 1;

  function addRel(
    sourceId: string,
    sourceType: any,
    targetId: string,
    targetType: any,
    type: RelationshipType,
    provenance: EvidenceRecord,
    confidence: 'exact' | 'inferred' | 'unresolved' = 'exact'
  ) {
    relationships.push({
      id: `rel_${relCounter++}`,
      repoId,
      sourceId,
      sourceType,
      targetId,
      targetType,
      type,
      provenance,
      confidence,
    });
  }

  // Maps for fast index lookups
  const fileByPath = new Map<string, FileRecord>();
  for (const file of files) {
    fileByPath.set(file.path, file);
  }

  const symbolByName = new Map<string, SymbolRecord[]>();
  for (const sym of symbols) {
    if (!symbolByName.has(sym.name)) symbolByName.set(sym.name, []);
    symbolByName.get(sym.name)!.push(sym);
  }

  // 1. FILE CONTAINS SYMBOL
  for (const sym of symbols) {
    addRel(
      sym.fileId,
      'file',
      sym.id,
      'symbol',
      'CONTAINS',
      {
        filePath: sym.filePath,
        startLine: sym.startLine,
        endLine: sym.endLine,
        reason: `File ${sym.filePath} defines ${sym.kind} ${sym.name}`,
      },
      'exact'
    );
  }

  // 2. IMPORTS & EXPORTS RELATIONSHIPS (FILE-TO-FILE and SYMBOL-TO-SYMBOL)
  for (const ie of importsExports) {
    if (ie.type === 'import' && ie.resolvedFilePath) {
      const targetFile = fileByPath.get(ie.resolvedFilePath);
      if (targetFile) {
        // File to File import
        addRel(
          ie.fileId,
          'file',
          targetFile.id,
          'file',
          'IMPORTS',
          {
            filePath: ie.filePath,
            startLine: ie.line,
            reason: `File ${ie.filePath} imports module from ${ie.resolvedFilePath}`,
          },
          'exact'
        );

        addRel(
          targetFile.id,
          'file',
          ie.fileId,
          'file',
          'IMPORTED_BY',
          {
            filePath: ie.resolvedFilePath,
            reason: `File ${ie.resolvedFilePath} is imported by ${ie.filePath}`,
          },
          'exact'
        );

        // Symbol to Symbol imports
        for (const symName of ie.symbols) {
          const targetSyms = symbolByName.get(symName)?.filter((s) => s.filePath === ie.resolvedFilePath);
          if (targetSyms && targetSyms.length > 0) {
            const importingFileSyms = symbols.filter((s) => s.fileId === ie.fileId);
            for (const impSym of importingFileSyms) {
              addRel(
                impSym.id,
                'symbol',
                targetSyms[0].id,
                'symbol',
                'IMPORTS',
                {
                  filePath: ie.filePath,
                  startLine: ie.line,
                  reason: `Symbol ${impSym.name} in ${ie.filePath} imports ${targetSyms[0].name} from ${ie.resolvedFilePath}`,
                },
                'exact'
              );
            }
          }
        }
      }
    }
  }

  // 3. AST CALL GRAPH RELATIONSHIPS (CALLS & CALLED_BY)
  for (const sym of symbols) {
    if (sym.calls && sym.calls.length > 0) {
      for (const call of sym.calls) {
        const rawTarget = call.targetName;
        const methodName = rawTarget.includes('.') ? rawTarget.split('.').pop()! : rawTarget;

        const candidateSyms = symbolByName.get(methodName);
        if (candidateSyms && candidateSyms.length > 0) {
          const targetSym = candidateSyms.find((s) => s.id !== sym.id) || candidateSyms[0];
          addRel(
            sym.id,
            'symbol',
            targetSym.id,
            'symbol',
            'CALLS',
            {
              filePath: sym.filePath,
              startLine: call.line,
              snippet: `Call expression: ${rawTarget}()`,
              reason: `Symbol ${sym.name} calls ${targetSym.name}() at line ${call.line}`,
            },
            'exact'
          );

          addRel(
            targetSym.id,
            'symbol',
            sym.id,
            'symbol',
            'CALLED_BY',
            {
              filePath: targetSym.filePath,
              reason: `Symbol ${targetSym.name} is called by ${sym.name}() in ${sym.filePath}`,
            },
            'exact'
          );
        }
      }
    }
  }

  // 4. INHERITANCE RELATIONSHIPS (EXTENDS & IMPLEMENTS)
  for (const sym of symbols) {
    if (sym.extendsClause) {
      const parentSyms = symbolByName.get(sym.extendsClause);
      if (parentSyms && parentSyms.length > 0) {
        addRel(
          sym.id,
          'symbol',
          parentSyms[0].id,
          'symbol',
          'EXTENDS',
          {
            filePath: sym.filePath,
            startLine: sym.startLine,
            reason: `${sym.kind} ${sym.name} extends ${parentSyms[0].name}`,
          },
          'exact'
        );
      }
    }

    if (sym.implementsClause) {
      for (const implName of sym.implementsClause) {
        const interfaceSyms = symbolByName.get(implName);
        if (interfaceSyms && interfaceSyms.length > 0) {
          addRel(
            sym.id,
            'symbol',
            interfaceSyms[0].id,
            'symbol',
            'IMPLEMENTS',
            {
              filePath: sym.filePath,
              startLine: sym.startLine,
              reason: `${sym.kind} ${sym.name} implements interface ${interfaceSyms[0].name}`,
            },
            'exact'
          );
        }
      }
    }
  }

  // 5. API ROUTE HANDLES & USES CONTROLLER / SERVICE
  for (const api of apis) {
    if (api.handlerSymbolId) {
      addRel(
        api.id,
        'api',
        api.handlerSymbolId,
        'symbol',
        'HANDLES',
        {
          filePath: api.filePath,
          reason: `API ${api.method} ${api.path} handled by symbol ${api.handlerName}`,
        },
        api.confidence
      );
    } else {
      const targetSyms = symbolByName.get(api.handlerName);
      if (targetSyms && targetSyms.length > 0) {
        addRel(
          api.id,
          'api',
          targetSyms[0].id,
          'symbol',
          'HANDLES',
          {
            filePath: api.filePath,
            reason: `API ${api.method} ${api.path} inferred handler ${api.handlerName}`,
          },
          'inferred'
        );
      }
    }
  }

  // 6. DATABASE QUERIES & USAGE RELATIONSHIPS
  for (const db of databases) {
    const file = fileByPath.get(db.filePath);
    if (file) {
      addRel(
        file.id,
        'file',
        db.id,
        'database',
        'QUERIES',
        {
          filePath: db.filePath,
          reason: `File ${db.filePath} queries database ${db.entityType} ${db.name}`,
        },
        'exact'
      );
    }
  }

  // 7. TEST RELATIONSHIPS (TESTED_BY)
  for (const test of tests) {
    const testFile = fileByPath.get(test.filePath);
    if (!testFile) continue;

    for (const targetPath of test.targetFilePaths) {
      const targetFile = fileByPath.get(targetPath);
      if (targetFile) {
        addRel(
          targetFile.id,
          'file',
          testFile.id,
          'file',
          'TESTED_BY',
          {
            filePath: test.filePath,
            reason: `Source file ${targetPath} tested by test suite ${test.filePath}`,
          },
          'exact'
        );
      }
    }

    for (const symId of test.targetSymbolIds) {
      const targetSym = symbols.find((s) => s.id === symId);
      if (targetSym) {
        addRel(
          targetSym.id,
          'symbol',
          testFile.id,
          'file',
          'TESTED_BY',
          {
            filePath: test.filePath,
            reason: `Symbol ${targetSym.name} tested by test suite ${test.filePath}`,
          },
          'exact'
        );
      }
    }
  }

  // 8. SYMBOL USES RELATIONSHIPS (e.g. AuthController USES AuthService)
  for (const sym of symbols) {
    if (!fileContents || !fileContents[sym.filePath]) continue;
    const content = fileContents[sym.filePath];

    for (const targetSym of symbols) {
      if (
        sym.id !== targetSym.id &&
        targetSym.name.length > 3 &&
        (targetSym.kind === 'class' || targetSym.kind === 'function' || targetSym.kind === 'method')
      ) {
        if (content.includes(targetSym.name)) {
          addRel(
            sym.id,
            'symbol',
            targetSym.id,
            'symbol',
            'USES',
            {
              filePath: sym.filePath,
              startLine: sym.startLine,
              endLine: sym.endLine,
              reason: `Symbol ${sym.name} references ${targetSym.kind} ${targetSym.name}`,
            },
            'inferred'
          );
        }
      }
    }
  }

  return relationships;
}
