/**
 * Aegis Repository Intelligence — Database Extractor
 * 
 * Detects database technologies, ORM models, schemas, repositories, and SQL queries.
 */

import { DatabaseRecord, FileRecord } from '../types';

export interface ExtractDatabaseInput {
  repoId: string;
  files: FileRecord[];
  fileContents: Record<string, string>;
}

export function extractDatabaseModels(input: ExtractDatabaseInput): DatabaseRecord[] {
  const { repoId, files, fileContents } = input;
  const dbRecords: DatabaseRecord[] = [];
  let dbCounter = 1;

  for (const file of files) {
    const content = fileContents[file.path];
    if (!content) continue;

    // 1. PRISMA SCHEMA DETECTION (schema.prisma)
    if (file.extension === '.prisma' || file.name === 'schema.prisma') {
      const modelRegex = /model\s+([A-Za-z0-9_]+)\s*\{([^}]+)\}/g;
      let match: RegExpExecArray | null;

      while ((match = modelRegex.exec(content)) !== null) {
        const modelName = match[1];
        const body = match[2];
        const fields = body
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('@@'))
          .map((l) => l.split(/\s+/)[0]);

        dbRecords.push({
          id: `db_${file.id}_${dbCounter++}`,
          repoId,
          fileId: file.id,
          filePath: file.path,
          technology: 'prisma',
          entityType: 'model',
          name: modelName,
          fields,
        });
      }
    }

    // 2. MONGOOSE SCHEMA DETECTION (new Schema(...) / mongoose.model('User', ...))
    const mongooseRegex = /mongoose\.model\s*\(\s*["']([^"']+)["']/g;
    let mgMatch: RegExpExecArray | null;
    while ((mgMatch = mongooseRegex.exec(content)) !== null) {
      dbRecords.push({
        id: `db_${file.id}_${dbCounter++}`,
        repoId,
        fileId: file.id,
        filePath: file.path,
        technology: 'mongoose',
        entityType: 'model',
        name: mgMatch[1],
      });
    }

    // 3. TYPEORM / SEQUELIZE ENTITY DECORATORS (@Entity('users') class User)
    const entityRegex = /@Entity\s*\(\s*["']?([^"'\)]*)["']?\s*\)\s*export\s+class\s+([A-Za-z0-9_]+)/g;
    let entMatch: RegExpExecArray | null;
    while ((entMatch = entityRegex.exec(content)) !== null) {
      const tableName = entMatch[1] || entMatch[2];
      dbRecords.push({
        id: `db_${file.id}_${dbCounter++}`,
        repoId,
        fileId: file.id,
        filePath: file.path,
        technology: 'typeorm',
        entityType: 'model',
        name: entMatch[2],
        queries: [tableName],
      });
    }

    // 4. SQL / PG DIRECT QUERY DETECTION (query('SELECT ... FROM users'))
    if (content.includes('SELECT') || content.includes('INSERT INTO') || content.includes('UPDATE ') || content.includes('DELETE FROM')) {
      const sqlTableRegex = /(?:FROM|INSERT\s+INTO|UPDATE|JOIN)\s+([a-zA-Z0-9_]+)/gi;
      let sqlMatch: RegExpExecArray | null;
      const detectedTables = new Set<string>();

      while ((sqlMatch = sqlTableRegex.exec(content)) !== null) {
        const table = sqlMatch[1].toLowerCase();
        if (!['where', 'set', 'select', 'values', 'inner', 'left', 'right', 'outer', 'on'].includes(table)) {
          detectedTables.add(table);
        }
      }

      for (const table of detectedTables) {
        dbRecords.push({
          id: `db_${file.id}_${dbCounter++}`,
          repoId,
          fileId: file.id,
          filePath: file.path,
          technology: 'sql',
          entityType: 'table',
          name: table,
          queries: [`Raw SQL query reference in ${file.name}`],
        });
      }
    }
  }

  return dbRecords;
}
