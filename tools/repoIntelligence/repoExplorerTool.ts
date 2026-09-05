/**
 * Aegis Repository Intelligence Explorer Tool
 * 
 * Tool for Planner, Researcher, Architect, Developer, Tester, and Security agents
 * to query codebase symbols, APIs, database models, tests, git history, and change impact.
 */

import { z } from 'zod';
import { getRepositoryStatus, queryRepositoryIntelligence } from '../../repo-intelligence/retrieval/hybridRetriever';
import { JsonRepositoryStore } from '../../repo-intelligence/storage/jsonStore';
import { createAegisTool } from '../types';

export const repoExplorerSchema = z.object({
  repoId: z.string().describe('Unique Aegis repository identity or path'),
  query: z.string().describe('Natural language question or search query'),
  action: z
    .enum(['query_structure', 'trace_flow', 'analyze_impact', 'search_symbols', 'get_repository_overview', 'query_status'])
    .optional()
    .describe('Specific intelligence action mode'),
  targetEntity: z.string().optional().describe('Target symbol, API route, or component name (e.g. AuthService, POST /login)'),
});

export type RepoExplorerInput = z.infer<typeof repoExplorerSchema>;

export async function executeRepoExplorer(input: RepoExplorerInput): Promise<string> {
  const store = new JsonRepositoryStore();
  const snapshot = await store.getSnapshot(input.repoId);

  if (!snapshot) {
    return JSON.stringify({
      error: `No persistent repository intelligence snapshot found for repoId="${input.repoId}". Please connect/analyze repository first.`,
    });
  }

  // Handle repository status action
  if (input.action === 'query_status') {
    return getRepositoryStatus(snapshot);
  }

  // Handle repository overview action
  if (input.action === 'get_repository_overview') {
    const repo = snapshot.repository;
    return JSON.stringify({
      repository: repo.name,
      provider: repo.provider,
      revision: repo.analyzedRevision,
      status: repo.status,
      summary: {
        totalFiles: snapshot.files.length,
        sourceFiles: snapshot.files.filter((f) => f.category === 'SOURCE').length,
        symbols: snapshot.symbols.length,
        relationships: snapshot.relationships.length,
        apiRoutes: snapshot.apis.length,
        databaseModels: snapshot.databases.length,
        tests: snapshot.tests.length,
      },
    }, null, 2);
  }

  const mode = input.action === 'search_symbols' ? 'structural' : 'hybrid';
  const result = await queryRepositoryIntelligence({
    snapshot,
    query: input.query,
    mode,
    targetEntity: input.targetEntity,
  });

  return result.formattedContext;
}

export const repoExplorerTool = createAegisTool(executeRepoExplorer, {
  name: 'repo_explorer_tool',
  description: 'Query repository intelligence: AST symbols, API routes, database schemas, tests, relationships, and change impact evidence.',
  schema: repoExplorerSchema,
});
