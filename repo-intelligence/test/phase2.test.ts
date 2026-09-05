/**
 * Phase 2 Test Suite — File Discovery, Classification, Ignore Rules & Security Sanitizer
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { classifyFile } from '../scanner/classifier';
import { scanRepositoryDirectory, shouldIgnoreFile } from '../scanner/fileScanner';
import { isSecretConfigFile, sanitizeRepositoryContent } from '../scanner/security';

async function runPhase2Tests() {
  console.log('--- Aegis Repository Intelligence — Phase 2 Test Suite ---');
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

  // Test 1: File Classification
  console.log('\n[1] File Classification');
  assert(classifyFile('src/services/auth.service.ts').category === 'SOURCE', 'Classifies auth.service.ts as SOURCE');
  assert(classifyFile('tests/auth.service.test.ts').category === 'TEST', 'Classifies auth.service.test.ts as TEST');
  assert(classifyFile('package.json').category === 'CONFIG', 'Classifies package.json as CONFIG');
  assert(classifyFile('README.md').category === 'DOCUMENTATION', 'Classifies README.md as DOCUMENTATION');
  assert(classifyFile('schema.prisma').category === 'SCHEMA', 'Classifies schema.prisma as SCHEMA');
  assert(classifyFile('package-lock.json').category === 'LOCKFILE', 'Classifies package-lock.json as LOCKFILE');
  assert(classifyFile('dist/app.js').category === 'GENERATED', 'Classifies dist/app.js as GENERATED');
  assert(classifyFile('logo.png').category === 'BINARY', 'Classifies logo.png as BINARY');

  // Test 2: Language Detection
  console.log('\n[2] Language Detection');
  assert(classifyFile('src/app.tsx').language === 'TSX' && classifyFile('src/app.tsx').isSupportedAstLanguage, 'Identifies TSX language');
  assert(classifyFile('scripts/dev.py').language === 'Python' && !classifyFile('scripts/dev.py').isSupportedAstLanguage, 'Identifies Python language with unsupported AST flag');

  // Test 3: Security Sanitizer
  console.log('\n[3] Security Sanitizer & Secret Redaction');
  const secretCode = `
    const API_KEY = "sk-1234567890abcdef1234567890abcdef";
    const JWT_SECRET = "super_secret_jwt_key_99";
    const GITHUB_TOKEN = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
  `;
  const sanitized = sanitizeRepositoryContent(secretCode);
  assert(sanitized.hasRedactions === true, 'Detects secret patterns in file content');
  assert(!sanitized.content.includes('sk-1234567890') && !sanitized.content.includes('super_secret_jwt_key_99'), 'Redacts API_KEY and JWT_SECRET');
  assert(sanitized.content.includes('[SECRET_REDACTED]'), 'Replaces credentials with [SECRET_REDACTED]');

  // Test 4: Secret Config Filter
  console.log('\n[4] Secret Config Filter');
  assert(isSecretConfigFile('.env') === true, 'Flags .env as secret config file');
  assert(isSecretConfigFile('.env.local') === true, 'Flags .env.local as secret config file');
  assert(isSecretConfigFile('.env.example') === false, 'Allows .env.example as safe template');

  // Test 5: Directory Scanner with Ignore Rules
  console.log('\n[5] Directory Scanner & Ignore Rules');
  const tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis_scan_test_'));
  try {
    fs.mkdirSync(path.join(tempRepoDir, 'src', 'services'), { recursive: true });
    fs.mkdirSync(path.join(tempRepoDir, 'node_modules', 'express'), { recursive: true });
    fs.mkdirSync(path.join(tempRepoDir, 'dist'), { recursive: true });

    fs.writeFileSync(path.join(tempRepoDir, 'src', 'services', 'auth.service.ts'), 'export class AuthService {}');
    fs.writeFileSync(path.join(tempRepoDir, 'package.json'), '{"name": "test-pkg"}');
    fs.writeFileSync(path.join(tempRepoDir, '.env'), 'DATABASE_PASSWORD=secret123');
    fs.writeFileSync(path.join(tempRepoDir, 'node_modules', 'express', 'index.js'), 'module.exports = {}');
    fs.writeFileSync(path.join(tempRepoDir, 'dist', 'bundle.js'), 'console.log("built")');

    const files = await scanRepositoryDirectory(tempRepoDir);

    const relPaths = files.map((f) => f.path);
    assert(relPaths.includes('src/services/auth.service.ts'), 'Discovers source file');
    assert(relPaths.includes('package.json'), 'Discovers config file');
    assert(!relPaths.includes('.env'), 'Filters out .env secret file');
    assert(!relPaths.some((p) => p.startsWith('node_modules')), 'Filters out node_modules directory');
    assert(!relPaths.some((p) => p.startsWith('dist')), 'Filters out dist directory');
  } finally {
    fs.rmSync(tempRepoDir, { recursive: true, force: true });
  }

  console.log(`\nPhase 2 Test Results: ${passed}/${total} assertions passed.`);
}

runPhase2Tests().catch((err) => {
  console.error('Phase 2 Test Suite Failed:', err);
  process.exit(1);
});
