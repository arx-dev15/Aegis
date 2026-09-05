/**
 * Aegis Repository Intelligence — File Classifier
 * 
 * Classifies files into categories (SOURCE, TEST, CONFIG, DOCUMENTATION, SCHEMA, MIGRATION, GENERATED, ASSET, LOCKFILE, BINARY, UNKNOWN)
 * and detects primary file languages.
 */

import path from 'path';
import { FileCategory } from '../types';

export interface FileClassificationResult {
  category: FileCategory;
  language: string;
  isSupportedAstLanguage: boolean;
}

export function classifyFile(filePath: string): FileClassificationResult {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = path.basename(normalized);
  const ext = path.extname(normalized).toLowerCase();
  const lowerPath = normalized.toLowerCase();

  // 1. LOCKFILES
  const lockfileNames = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'cargo.lock', 'gemfile.lock', 'poetry.lock', 'mix.lock'];
  if (lockfileNames.includes(basename.toLowerCase())) {
    return { category: 'LOCKFILE', language: 'Lockfile', isSupportedAstLanguage: false };
  }

  // 2. BINARY / COMPRESSED FILES
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib', '.pyc', '.class', '.o', '.db', '.sqlite', '.woff', '.ttf', '.eot'];
  if (binaryExtensions.includes(ext)) {
    return { category: 'BINARY', language: 'Binary', isSupportedAstLanguage: false };
  }

  // 3. GENERATED FILES
  const pathParts = lowerPath.split('/');
  if (
    pathParts.includes('dist') ||
    pathParts.includes('build') ||
    pathParts.includes('out') ||
    pathParts.includes('.next') ||
    basename.endsWith('.min.js') ||
    basename.endsWith('.min.css') ||
    basename.endsWith('.bundle.js')
  ) {
    return { category: 'GENERATED', language: detectLanguage(ext, basename), isSupportedAstLanguage: false };
  }

  // 4. MIGRATION FILES
  if (pathParts.includes('migrations') || pathParts.includes('migration') || pathParts.includes('migrate')) {
    return { category: 'MIGRATION', language: detectLanguage(ext, basename), isSupportedAstLanguage: false };
  }

  // 5. TEST FILES
  if (
    basename.includes('.test.') ||
    basename.includes('.spec.') ||
    basename.endsWith('_test.go') ||
    basename.endsWith('Test.java') ||
    pathParts.includes('tests') ||
    pathParts.includes('__tests__') ||
    pathParts.includes('spec')
  ) {
    const language = detectLanguage(ext, basename);
    const isSupportedAstLanguage = ['TypeScript', 'JavaScript', 'TSX', 'JSX'].includes(language);
    return { category: 'TEST', language, isSupportedAstLanguage };
  }

  // 6. SCHEMAS
  if (ext === '.prisma' || ext === '.graphql' || ext === '.gql' || ext === '.proto' || basename === 'schema.json') {
    return { category: 'SCHEMA', language: 'Schema', isSupportedAstLanguage: false };
  }

  // 7. CONFIG FILES
  const configNames = ['package.json', 'tsconfig.json', '.gitignore', 'dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'vite.config.ts', 'vite.config.js', 'next.config.js', 'next.config.ts', 'tailwind.config.js', 'postcss.config.js', '.env.example'];
  if (configNames.includes(basename.toLowerCase()) || basename.startsWith('.eslintrc') || basename.startsWith('eslint.config')) {
    return { category: 'CONFIG', language: detectLanguage(ext, basename), isSupportedAstLanguage: false };
  }

  // 8. DOCUMENTATION
  if (ext === '.md' || ext === '.rst' || ext === '.txt' || basename.toLowerCase() === 'license' || basename.toLowerCase() === 'readme') {
    return { category: 'DOCUMENTATION', language: 'Markdown', isSupportedAstLanguage: false };
  }

  // 9. ASSETS
  if (ext === '.svg' || ext === '.mp3' || ext === '.mp4' || ext === '.webm' || ext === '.wav') {
    return { category: 'ASSET', language: 'Asset', isSupportedAstLanguage: false };
  }

  // 10. SOURCE FILES
  const sourceExts: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TSX',
    '.js': 'JavaScript',
    '.jsx': 'JSX',
    '.mjs': 'JavaScript',
    '.cjs': 'JavaScript',
    '.py': 'Python',
    '.go': 'Go',
    '.java': 'Java',
    '.rs': 'Rust',
    '.c': 'C',
    '.cpp': 'C++',
    '.cs': 'C#',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.json': 'JSON',
  };

  if (sourceExts[ext]) {
    const language = sourceExts[ext];
    const isSupportedAstLanguage = ['TypeScript', 'JavaScript', 'TSX', 'JSX'].includes(language);
    return { category: 'SOURCE', language, isSupportedAstLanguage };
  }

  return { category: 'UNKNOWN', language: 'Unknown', isSupportedAstLanguage: false };
}

function detectLanguage(ext: string, basename: string): string {
  if (ext === '.ts') return 'TypeScript';
  if (ext === '.tsx') return 'TSX';
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return 'JavaScript';
  if (ext === '.jsx') return 'JSX';
  if (ext === '.json' || basename.endsWith('.json')) return 'JSON';
  if (ext === '.md') return 'Markdown';
  if (ext === '.py') return 'Python';
  if (ext === '.go') return 'Go';
  if (ext === '.java') return 'Java';
  if (ext === '.rs') return 'Rust';
  if (ext === '.sql') return 'SQL';
  if (ext === '.yml' || ext === '.yaml') return 'YAML';
  return 'Text';
}
