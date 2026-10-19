/**
 * Aegis Repository Intelligence — Security Sanitizer
 * 
 * Ensures repository code is parsed as static data (preventing instruction injection or execution),
 * and redacts secret keys/passwords/tokens from parsed content deterministically.
 */

export interface SecuritySanitizeResult {
  content: string;
  hasRedactions: boolean;
  redactedKeys: string[];
}

const SECRET_PATTERNS = [
  { name: 'API Key', regex: /(api[_-]?key\s*[:=]\s*["']?)([^"'\s;]+)(["']?)/gi },
  { name: 'JWT Secret', regex: /(jwt[_-]?secret\s*[:=]\s*["']?)([^"'\s;]+)(["']?)/gi },
  { name: 'Database Password', regex: /(db[_-]?password|database[_-]?password|postgres[_-]?password|mysql[_-]?password\s*[:=]\s*["']?)([^"'\s;]+)(["']?)/gi },
  { name: 'Secret Key', regex: /(secret[_-]?key\s*[:=]\s*["']?)([^"'\s;]+)(["']?)/gi },
  { name: 'AWS Secret Access Key', regex: /(aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*["']?)([^"'\s;]+)(["']?)/gi },
  { name: 'GitHub Token', regex: /(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,})/gi },
  { name: 'Private Key Header', regex: /(-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----)/gi },
];

export function sanitizeRepositoryContent(content: string): SecuritySanitizeResult {
  if (!content) {
    return { content: '', hasRedactions: false, redactedKeys: [] };
  }

  let sanitized = content;
  let hasRedactions = false;
  const redactedKeys: string[] = [];

  for (const pattern of SECRET_PATTERNS) {
    const rxTest = new RegExp(pattern.regex.source, 'i');
    const rxReplace = new RegExp(pattern.regex.source, 'gi');

    if (rxTest.test(sanitized)) {
      hasRedactions = true;
      redactedKeys.push(pattern.name);

      if (pattern.name === 'GitHub Token') {
        sanitized = sanitized.replace(rxReplace, '[SECRET_REDACTED]');
      } else if (pattern.name === 'Private Key Header') {
        sanitized = sanitized.replace(rxReplace, '-----BEGIN PRIVATE KEY-----\n[SECRET_REDACTED]\n-----END PRIVATE KEY-----');
      } else {
        sanitized = sanitized.replace(rxReplace, '$1[SECRET_REDACTED]$3');
      }
    }
  }

  return {
    content: sanitized,
    hasRedactions,
    redactedKeys,
  };
}

export function isSecretConfigFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const basename = normalized.split('/').pop() || '';

  // .env, .env.local, .env.production, etc. should be handled with extreme care
  return basename.startsWith('.env') && !basename.endsWith('.example');
}
