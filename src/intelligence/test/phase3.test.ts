/**
 * Phase 3 Test Suite — AST Parsing, Symbol Extractor & Import/Export Resolution
 */

import { extractImportExports, resolveRelativeImportPath } from '../extractors/importExportExtractor';
import { parseTypeScriptSymbols } from '../parsers/tsParser';

async function runPhase3Tests() {
  console.log('--- Aegis Repository Intelligence — Phase 3 Test Suite ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      throw new Error(`Test assertion failed: ${msg}`);
    }
  }

  // Sample TypeScript source file
  const sourceCode = `
    import { User } from '../models/user.model';
    import express from 'express';

    export interface AuthConfig {
      secret: string;
      expiresIn: number;
    }

    export type UserRole = 'admin' | 'user';

    export enum AuthStatus {
      ACTIVE = 'ACTIVE',
      DISABLED = 'DISABLED'
    }

    export class AuthService {
      private secretKey: string;

      constructor(config: AuthConfig) {
        this.secretKey = config.secret;
      }

      public async login(email: string, pass: string): Promise<string> {
        const user = await this.findUser(email);
        return "token_123";
      }

      private findUser(email: string): User | null {
        return null;
      }
    }

    export const DEFAULT_TIMEOUT = 5000;
  `;

  // Test 1: Symbol Extraction
  console.log('\n[1] AST Symbol Extraction');
  const symbols = parseTypeScriptSymbols({
    repoId: 'repo_test',
    fileId: 'file_auth_service',
    filePath: 'src/services/auth.service.ts',
    content: sourceCode,
    language: 'TypeScript',
  });

  const authClass = symbols.find((s) => s.name === 'AuthService');
  assert(authClass !== undefined && authClass.kind === 'class' && authClass.exported, 'Extracts class AuthService with exported=true');

  const authConfigInterface = symbols.find((s) => s.name === 'AuthConfig');
  assert(authConfigInterface !== undefined && authConfigInterface.kind === 'interface', 'Extracts interface AuthConfig');

  const userRoleType = symbols.find((s) => s.name === 'UserRole');
  assert(userRoleType !== undefined && userRoleType.kind === 'type', 'Extracts type UserRole');

  const authStatusEnum = symbols.find((s) => s.name === 'AuthStatus');
  assert(authStatusEnum !== undefined && authStatusEnum.kind === 'enum', 'Extracts enum AuthStatus');

  const loginMethod = symbols.find((s) => s.name === 'login');
  assert(
    loginMethod !== undefined &&
      loginMethod.kind === 'method' &&
      loginMethod.parentSymbolId === authClass?.id &&
      loginMethod.visibility === 'public',
    'Extracts method login() with parent class link and visibility'
  );
  assert(loginMethod?.parameters?.length === 2 && loginMethod.parameters[0].name === 'email', 'Extracts method parameters');

  const timeoutConst = symbols.find((s) => s.name === 'DEFAULT_TIMEOUT');
  assert(timeoutConst !== undefined && timeoutConst.kind === 'constant', 'Extracts exported constant DEFAULT_TIMEOUT');

  // Test 2: React Component Extraction in TSX
  console.log('\n[2] React TSX Component Extraction');
  const tsxCode = `
    import React from 'react';

    export function UserCard(props: { name: string }) {
      return <div>{props.name}</div>;
    }
  `;
  const tsxSymbols = parseTypeScriptSymbols({
    repoId: 'repo_test',
    fileId: 'file_user_card',
    filePath: 'src/components/UserCard.tsx',
    content: tsxCode,
    language: 'TSX',
  });

  const componentSym = tsxSymbols.find((s) => s.name === 'UserCard');
  assert(componentSym !== undefined && componentSym.kind === 'component', 'Extracts UserCard as React component in TSX file');

  // Test 3: Import/Export Extraction & Resolution
  console.log('\n[3] Import/Export Extraction & Relative Resolution');
  const allWorkspaceFiles = [
    'src/controllers/auth.controller.ts',
    'src/services/auth.service.ts',
    'src/models/user.model.ts',
    'package.json',
  ];

  const importExportRecords = extractImportExports({
    repoId: 'repo_test',
    fileId: 'file_auth_controller',
    filePath: 'src/controllers/auth.controller.ts',
    content: `
      import { AuthService } from '../services/auth.service';
      import express from 'express';
      export { AuthService };
    `,
    allFilePaths: allWorkspaceFiles,
  });

  const relativeImport = importExportRecords.find((r) => r.moduleSpecifier === '../services/auth.service');
  assert(relativeImport !== undefined && relativeImport.symbols.includes('AuthService'), 'Extracts relative import statement');
  assert(relativeImport?.resolvedFilePath === 'src/services/auth.service.ts', 'Resolves relative import specifier to exact workspace file target');

  const externalImport = importExportRecords.find((r) => r.moduleSpecifier === 'express');
  assert(externalImport !== undefined && externalImport.resolvedFilePath === undefined, 'Handles external package import without false file resolution');

  console.log(`\nPhase 3 Test Results: ${passed}/${total} assertions passed.`);
}

runPhase3Tests().catch((err) => {
  console.error('Phase 3 Test Suite Failed:', err);
  process.exit(1);
});
