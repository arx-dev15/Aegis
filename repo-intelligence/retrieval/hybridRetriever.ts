/**
 * Aegis Repository Intelligence — Hybrid Retrieval Engine
 * 
 * Combines structural graph/symbol traversal with semantic vector RAG embeddings
 * to produce evidence-backed, traceable context for Aegis agents.
 * Includes dynamic multi-hop graph traversal (BFS) for flow tracing and impact analysis.
 */

import { ProjectKnowledge } from '../../rag/projectKnowledge';
import {
  ApiRecord,
  DatabaseRecord,
  EvidenceRecord,
  FileRecord,
  RelationshipRecord,
  RepositorySnapshot,
  SymbolRecord,
  TestRecord,
} from '../types';

export interface HybridQueryInput {
  snapshot: RepositorySnapshot;
  query: string;
  mode?: 'structural' | 'semantic' | 'hybrid';
  targetEntity?: string;
  projectKnowledge?: ProjectKnowledge;
}

export interface DynamicImpactReport {
  targetEntity: string;
  targetResolutionStatus: 'exact' | 'case' | 'partial' | 'candidate' | 'unresolved';
  resolvedSymbol?: { name: string; file: string; kind: string };
  candidates: Array<{ name: string; file: string; kind: string }>;
  directDependents: Array<{ name: string; file: string; type: string; edgeType: string; reason: string }>;
  affectedApis: Array<{ method: string; path: string; file: string }>;
  affectedTests: Array<{ name: string; file: string }>;
  flowSteps: Array<{ step: number; entity: string; type: string; file: string; line?: number }>;
  message: string;
}

export type AnswerStatus = 'ANSWERED' | 'PARTIALLY_ANSWERED' | 'INSUFFICIENT_EVIDENCE' | 'TARGET_NOT_FOUND';

export interface HybridRetrievalResult {
  query: string;
  mode: 'structural' | 'semantic' | 'hybrid';
  answerStatus: AnswerStatus;
  structuralEvidenceCount: number;
  semanticEvidenceCount: number;
  symbols: SymbolRecord[];
  apis: ApiRecord[];
  databases: DatabaseRecord[];
  tests: TestRecord[];
  relationships: RelationshipRecord[];
  evidence: EvidenceRecord[];
  impactReport?: DynamicImpactReport;
  formattedContext: string;
  statusSummary?: string;
}

const knowledgeCache = new Map<string, ProjectKnowledge>();

export function getCachedProjectKnowledge(repoId: string): ProjectKnowledge | undefined {
  return knowledgeCache.get(repoId);
}

export function setCachedProjectKnowledge(repoId: string, pk: ProjectKnowledge): void {
  knowledgeCache.set(repoId, pk);
}

export async function findMatchingRepoSnapshot(
  workspace: string,
  store: InstanceType<typeof import('../storage/jsonStore').JsonRepositoryStore> = new (require('../storage/jsonStore').JsonRepositoryStore)()
): Promise<RepositorySnapshot | null> {
  try {
    const repos = await store.listRepositories();
    if (!repos || repos.length === 0) return null;

    const pathModule = require('path');
    const normalizedWs = pathModule.resolve(workspace).toLowerCase();
    const wsBasename = pathModule.basename(normalizedWs).toLowerCase();

    for (const repo of repos) {
      if (repo.url) {
        const repoPath = pathModule.resolve(repo.url.replace(/^file:\/\//, '')).toLowerCase();
        if (repoPath === normalizedWs) {
          return await store.getSnapshot(repo.id);
        }
      }
      const nameLower = (repo.name || '').toLowerCase();
      if (wsBasename === nameLower || nameLower === wsBasename) {
        return await store.getSnapshot(repo.id);
      }
    }
  } catch {}
  return null;
}

export function getRepositoryStatus(snapshot: RepositorySnapshot): string {
  const repo = snapshot.repository;
  const isGithub = repo.provider === 'github';
  const hasSemantic = Boolean(getCachedProjectKnowledge(repo.id));

  const lines = [
    `--- REPOSITORY INTELLIGENCE STATUS ---`,
    `Source: ${isGithub ? 'GitHub Remote' : 'Local Repository'}`,
    `Repository: ${repo.owner}/${repo.name} (${repo.url})`,
    `Revision / Commit: ${repo.analyzedRevision} (${repo.commitSha.substring(0, 7)})`,
    `Status: ${repo.status.toUpperCase()}`,
    `Last Analyzed: ${repo.updatedAt}`,
    ``,
    `Discovered Files: ${snapshot.files.length} (${snapshot.files.filter((f) => f.category === 'SOURCE').length} source)`,
    `AST Symbols: ${snapshot.symbols.length}`,
    `API Routes: ${snapshot.apis.length}`,
    `Database Models: ${snapshot.databases.length}`,
    `Test Suites: ${snapshot.tests.length}`,
    `Graph Edges: ${snapshot.relationships.length}`,
    ``,
    `Retrieval Capabilities:`,
    `  ✓ Structural Graph Search: ACTIVE`,
    `  ${hasSemantic ? '✓' : '○'} Semantic Vector RAG: ${hasSemantic ? 'ACTIVE' : 'INACTIVE (Structural Mode)'}`,
    `  ✓ JSON Storage: ACTIVE`,
    `--------------------------------------`,
  ];

  return lines.join('\n');
}

export async function queryRepositoryIntelligence(input: HybridQueryInput): Promise<HybridRetrievalResult> {
  const { snapshot, query, mode = 'hybrid', targetEntity, projectKnowledge: explicitPK } = input;

  const matchedSymbols: SymbolRecord[] = [];
  const matchedApis: ApiRecord[] = [];
  const matchedDatabases: DatabaseRecord[] = [];
  const matchedTests: TestRecord[] = [];
  const tracedRelationships: RelationshipRecord[] = [];
  const evidenceList: EvidenceRecord[] = [];

  const lowerQuery = query.toLowerCase();
  const searchTarget = targetEntity ? targetEntity.toLowerCase() : lowerQuery;
  const queryTerms = lowerQuery
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/gi, ''))
    .filter((t) => t.length > 3 && !['find', 'where', 'show', 'what', 'handled', 'service', 'does', 'when'].includes(t));

  const stems = Array.from(
    new Set([
      searchTarget.length >= 4 ? searchTarget.substring(0, 4) : searchTarget,
      ...queryTerms.map((t) => (t.length >= 4 ? t.substring(0, 4) : t)),
    ])
  ).filter((s) => s.length >= 3);

  // Check for subjective / unanswerable intent questions (e.g. "Why did the developer choose PostgreSQL?")
  const isSubjectiveQuestion =
    /^(why|how come)\s+(did|was|is|does)\b/i.test(query.trim()) &&
    !stems.some((s) => ['auth', 'proj', 'user', 'create', 'login'].includes(s));

  // 1. STRUCTURAL SEARCH & SYMBOL MATCHING
  if (mode === 'structural' || mode === 'hybrid') {
    for (const sym of snapshot.symbols) {
      const symNameLower = sym.name.toLowerCase();
      const matchesTarget = targetEntity ? symNameLower.includes(searchTarget) || searchTarget.includes(symNameLower) : false;
      const matchesTerms = queryTerms.length > 0 && queryTerms.some((term) => symNameLower.includes(term));
      const matchesStems = stems.length > 0 && stems.some((stem) => symNameLower.includes(stem));

      if (matchesTarget || matchesTerms || matchesStems) {
        matchedSymbols.push(sym);
        evidenceList.push({
          filePath: sym.filePath,
          startLine: sym.startLine,
          endLine: sym.endLine,
          reason: `Matched AST symbol ${sym.kind} ${sym.name}`,
        });
      }
    }

    const matchedSymIds = new Set(matchedSymbols.map((s) => s.id));

    // Find APIs by route path, handler name, query terms, stems, or connected HANDLES edges
    for (const api of snapshot.apis) {
      const handlerLower = api.handlerName.toLowerCase();
      const pathLower = api.path.toLowerCase();
      const fileLower = api.filePath.toLowerCase();

      const matchesTarget = targetEntity ? pathLower.includes(searchTarget) || handlerLower.includes(searchTarget) : false;
      const matchesTerms = queryTerms.length > 0 && queryTerms.some((term) => handlerLower.includes(term) || pathLower.includes(term));
      const matchesStems = stems.length > 0 && stems.some((stem) => handlerLower.includes(stem) || pathLower.includes(stem) || fileLower.includes(stem));
      const matchesSymbolLink = api.handlerSymbolId ? matchedSymIds.has(api.handlerSymbolId) : false;
      const matchesGraphLink = snapshot.relationships.some(
        (r) => r.type === 'HANDLES' && r.sourceId === api.id && matchedSymIds.has(r.targetId)
      );

      if (matchesTarget || matchesTerms || matchesStems || matchesSymbolLink || matchesGraphLink) {
        matchedApis.push(api);
        evidenceList.push({
          filePath: api.filePath,
          reason: `Matched API route ${api.method} ${api.path}`,
        });
      }
    }

    // Find DB models
    for (const db of snapshot.databases) {
      const dbNameLower = db.name.toLowerCase();
      const fileLower = db.filePath.toLowerCase();
      const matchesTerms = queryTerms.length > 0 && queryTerms.some((term) => dbNameLower.includes(term));
      const matchesStems = stems.length > 0 && stems.some((stem) => dbNameLower.includes(stem) || fileLower.includes(stem));

      if (dbNameLower.includes(searchTarget) || matchesTerms || matchesStems) {
        matchedDatabases.push(db);
        evidenceList.push({
          filePath: db.filePath,
          reason: `Matched DB ${db.entityType} ${db.name}`,
        });
      }
    }

    // Find Tests
    for (const test of snapshot.tests) {
      const testNameLower = test.testName.toLowerCase();
      const fileLower = test.filePath.toLowerCase();
      const matchesTerms = queryTerms.length > 0 && queryTerms.some((term) => testNameLower.includes(term));
      const matchesStems = stems.length > 0 && stems.some((stem) => testNameLower.includes(stem) || fileLower.includes(stem));

      if (testNameLower.includes(searchTarget) || matchesTerms || matchesStems) {
        matchedTests.push(test);
        evidenceList.push({
          filePath: test.filePath,
          reason: `Matched Test Suite ${test.testName}`,
        });
      }
    }

    // Trace graph relationships for matched entities
    const matchedEntityIds = new Set<string>([
      ...matchedSymbols.map((s) => s.id),
      ...matchedApis.map((a) => a.id),
      ...matchedDatabases.map((d) => d.id),
      ...matchedTests.map((t) => t.id),
    ]);

    // Prioritize direct CALLS / IMPORTS / HANDLES over generic USES
    const sortedRels = [...snapshot.relationships].sort((a, b) => {
      const priorityOrder: Record<string, number> = { HANDLES: 1, CALLS: 2, IMPORTS: 3, QUERIES: 4, EXTENDS: 5, IMPLEMENTS: 6, TESTED_BY: 7, USES: 8 };
      return (priorityOrder[a.type] || 99) - (priorityOrder[b.type] || 99);
    });

    for (const rel of sortedRels) {
      if (matchedEntityIds.has(rel.sourceId) || matchedEntityIds.has(rel.targetId)) {
        tracedRelationships.push(rel);
        if (rel.provenance) evidenceList.push(rel.provenance);
      }
    }
  }

  // 2. DYNAMIC MULTI-HOP GRAPH TRAVERSAL & IMPACT REPORT
  const targetName = targetEntity || (matchedSymbols.length > 0 ? matchedSymbols[0].name : 'Component');
  const impactReport = computeDynamicImpactReport(snapshot, targetName);

  // 3. SEMANTIC SEARCH (via cached or explicit ProjectKnowledge)
  let semanticMarkdown = '';
  let semanticCount = 0;
  let activeMode: 'structural' | 'semantic' | 'hybrid' = mode;

  const pk = explicitPK || getCachedProjectKnowledge(snapshot.repository.id);
  if ((mode === 'semantic' || mode === 'hybrid') && pk) {
    try {
      semanticMarkdown = await pk.getFormattedContext(query, 3);
      semanticCount = semanticMarkdown ? 3 : 0;
    } catch {}
  } else if (mode === 'hybrid' && !pk) {
    activeMode = 'structural';
  }

  // 4. DETERMINE ANSWER STATUS
  let answerStatus: AnswerStatus = 'ANSWERED';
  if (isSubjectiveQuestion) {
    answerStatus = 'INSUFFICIENT_EVIDENCE';
  } else if (targetEntity && impactReport.targetResolutionStatus === 'unresolved') {
    answerStatus = 'TARGET_NOT_FOUND';
  } else if (impactReport.targetResolutionStatus === 'unresolved' && matchedSymbols.length === 0 && matchedApis.length === 0) {
    answerStatus = 'TARGET_NOT_FOUND';
  } else if (/auth|authentication|login|credential/i.test(query)) {
    const hasStrictAuthCode = snapshot.symbols.some((s) =>
      /login|jwt|password|token|credential/i.test(s.name) || /auth\.service|auth\.controller/i.test(s.filePath)
    );
    if (!hasStrictAuthCode) {
      answerStatus = 'PARTIALLY_ANSWERED';
    }
  }

  // 5. FORMAT EVIDENCE-BACKED CONTEXT MARKDOWN
  const formattedContext = formatEvidenceContext({
    query,
    mode: activeMode,
    answerStatus,
    structuralEvidenceCount: evidenceList.length,
    semanticEvidenceCount: semanticCount,
    symbols: matchedSymbols,
    apis: matchedApis,
    databases: matchedDatabases,
    tests: matchedTests,
    relationships: tracedRelationships,
    evidence: evidenceList,
    impactReport,
    semanticMarkdown,
  });

  return {
    query,
    mode: activeMode,
    answerStatus,
    structuralEvidenceCount: evidenceList.length,
    semanticEvidenceCount: semanticCount,
    symbols: matchedSymbols,
    apis: matchedApis,
    databases: matchedDatabases,
    tests: matchedTests,
    relationships: tracedRelationships,
    evidence: evidenceList,
    impactReport,
    formattedContext,
    statusSummary: getRepositoryStatus(snapshot),
  };
}

export function computeDynamicImpactReport(snapshot: RepositorySnapshot, targetName: string): DynamicImpactReport {
  const directDependents: Array<{ name: string; file: string; type: string; edgeType: string; reason: string }> = [];
  const affectedApis: Array<{ method: string; path: string; file: string }> = [];
  const affectedTests: Array<{ name: string; file: string }> = [];
  const flowSteps: Array<{ step: number; entity: string; type: string; file: string; line?: number }> = [];
  const candidates: Array<{ name: string; file: string; kind: string }> = [];

  const targetLower = targetName.toLowerCase();

  // Stage 1: Exact Symbol Match
  let resolvedSymbol = snapshot.symbols.find((s) => s.name === targetName);
  let status: 'exact' | 'case' | 'partial' | 'candidate' | 'unresolved' = 'exact';

  // Stage 2: Case-Insensitive Match
  if (!resolvedSymbol) {
    resolvedSymbol = snapshot.symbols.find((s) => s.name.toLowerCase() === targetLower);
    if (resolvedSymbol) status = 'case';
  }

  // Stage 3: Partial Match
  if (!resolvedSymbol) {
    const partials = snapshot.symbols.filter(
      (s) => s.name.toLowerCase().includes(targetLower) && s.name.length >= 4
    );
    if (partials.length > 0) {
      resolvedSymbol = partials[0];
      status = 'partial';
      for (const p of partials.slice(1, 6)) {
        candidates.push({ name: p.name, file: p.filePath, kind: p.kind });
      }
    }
  }

  // Stage 4: Candidate Match via Graph/Files
  if (!resolvedSymbol) {
    status = 'unresolved';
    for (const sym of snapshot.symbols) {
      if (
        sym.name.toLowerCase().startsWith(targetLower.substring(0, 4)) ||
        sym.filePath.toLowerCase().includes(targetLower)
      ) {
        if (!candidates.some((c) => c.name === sym.name)) {
          candidates.push({ name: sym.name, file: sym.filePath, kind: sym.kind });
        }
      }
    }

    return {
      targetEntity: targetName,
      targetResolutionStatus: 'unresolved',
      candidates: candidates.slice(0, 5),
      directDependents: [],
      affectedApis: [],
      affectedTests: [],
      flowSteps: [],
      message: `Target entity "${targetName}" was not found in AST index. Identified ${candidates.length} candidate matches. No impact analysis was performed for ${targetName}.`,
    };
  }

  // Target successfully resolved — compute impact graph
  const targetSymIds = new Set<string>([resolvedSymbol.id]);

  // Traversal Hop 1: Direct Dependent Symbols (Prioritizing CALLS / IMPORTS / EXTENDS over generic USES)
  const relsForTarget = snapshot.relationships.filter((rel) => targetSymIds.has(rel.targetId));
  relsForTarget.sort((a, b) => {
    const priority: Record<string, number> = { CALLS: 1, IMPORTS: 2, EXTENDS: 3, IMPLEMENTS: 4, USES: 5 };
    return (priority[a.type] || 99) - (priority[b.type] || 99);
  });

  for (const rel of relsForTarget) {
    if (['USES', 'CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS'].includes(rel.type)) {
      const callerSym = snapshot.symbols.find((s) => s.id === rel.sourceId);
      if (callerSym && !directDependents.some((d) => d.name === callerSym.name)) {
        const edgeReason = rel.type === 'CALLS'
          ? 'direct function call'
          : rel.type === 'IMPORTS'
          ? 'imported symbol reference'
          : rel.type === 'EXTENDS'
          ? 'class inheritance'
          : 'inferred symbol reference';

        directDependents.push({
          name: callerSym.name,
          file: callerSym.filePath,
          type: callerSym.kind,
          edgeType: rel.type,
          reason: edgeReason,
        });
      }
    }
  }

  // Traversal Hop 2: Affected API Routes
  for (const api of snapshot.apis) {
    if (
      api.handlerName.toLowerCase().includes(targetLower) ||
      directDependents.some((d) => api.handlerName.includes(d.name))
    ) {
      if (!affectedApis.some((a) => a.path === api.path && a.method === api.method)) {
        affectedApis.push({
          method: api.method,
          path: api.path,
          file: api.filePath,
        });
      }
    }
  }

  // Traversal Hop 3: Affected Test Suites
  for (const test of snapshot.tests) {
    if (
      test.testName.toLowerCase().includes(targetLower) ||
      test.targetSymbolIds.some((id) => targetSymIds.has(id)) ||
      directDependents.some((d) => test.testName.includes(d.name))
    ) {
      if (!affectedTests.some((t) => t.file === test.filePath)) {
        affectedTests.push({
          name: test.testName,
          file: test.filePath,
        });
      }
    }
  }

  // Build Execution Flow Steps
  let step = 1;
  if (affectedApis.length > 0) {
    flowSteps.push({
      step: step++,
      entity: `${affectedApis[0].method} ${affectedApis[0].path}`,
      type: 'API Endpoint',
      file: affectedApis[0].file,
    });
  }

  for (const dep of directDependents.slice(0, 2)) {
    flowSteps.push({
      step: step++,
      entity: dep.name,
      type: `${dep.type} (${dep.reason})`,
      file: dep.file,
    });
  }

  flowSteps.push({
    step: step++,
    entity: resolvedSymbol.name,
    type: `${resolvedSymbol.kind} (Resolved Target: ${status})`,
    file: resolvedSymbol.filePath,
    line: resolvedSymbol.startLine,
  });

  for (const db of snapshot.databases) {
    if (db.name.toLowerCase().includes(targetLower) || targetLower.includes(db.name.toLowerCase())) {
      flowSteps.push({
        step: step++,
        entity: `${db.technology.toUpperCase()} Model: ${db.name}`,
        type: 'Database Model',
        file: db.filePath,
      });
      break;
    }
  }

  return {
    targetEntity: targetName,
    targetResolutionStatus: status,
    resolvedSymbol: { name: resolvedSymbol.name, file: resolvedSymbol.filePath, kind: resolvedSymbol.kind },
    candidates: candidates.slice(0, 5),
    directDependents,
    affectedApis,
    affectedTests,
    flowSteps,
    message: `Target entity "${targetName}" resolved as ${resolvedSymbol.kind} "${resolvedSymbol.name}" (${status} match) in ${resolvedSymbol.filePath}.`,
  };
}

function formatEvidenceContext(data: {
  query: string;
  mode: string;
  answerStatus: AnswerStatus;
  structuralEvidenceCount: number;
  semanticEvidenceCount: number;
  symbols: SymbolRecord[];
  apis: ApiRecord[];
  databases: DatabaseRecord[];
  tests: TestRecord[];
  relationships: RelationshipRecord[];
  evidence: EvidenceRecord[];
  impactReport?: DynamicImpactReport;
  semanticMarkdown: string;
}): string {
  const parts: string[] = [];
  parts.push(`### AEGIS REPOSITORY INTELLIGENCE EVIDENCE`);
  parts.push(`**Query**: "${data.query}" | **Retrieval Mode**: ${data.mode} | **Answer Status**: ${data.answerStatus}`);
  parts.push(`**Evidence Count**: ${data.structuralEvidenceCount} structural records, ${data.semanticEvidenceCount} semantic chunks`);

  if (data.answerStatus === 'INSUFFICIENT_EVIDENCE') {
    parts.push(`\n> [!NOTE]`);
    parts.push(`> The repository contains static codebase evidence, but does not contain documentation or telemetry answering subjective architectural intent or runtime performance.`);
  }

  if (data.answerStatus === 'PARTIALLY_ANSWERED' && data.query.toLowerCase().includes('auth')) {
    parts.push(`\n> [!NOTE]`);
    parts.push(`> I could not identify a conventional authentication implementation (e.g. user login, JWT token signing, password hashing). Related security & approval mechanisms found are listed below:`);
  }

  if (data.impactReport) {
    parts.push(`\n#### Target Resolution & Impact Report:`);
    parts.push(`- **Status**: \`${data.impactReport.targetResolutionStatus}\``);
    parts.push(`- **Message**: ${data.impactReport.message}`);

    if (data.impactReport.candidates.length > 0) {
      parts.push(`- **Candidate Matches**: ${data.impactReport.candidates.map((c) => `\`${c.kind} ${c.name}\` (${c.file})`).join(', ')}`);
    }

    if (data.impactReport.directDependents.length > 0) {
      parts.push(`- **Affected Dependents**:`);
      for (const dep of data.impactReport.directDependents.slice(0, 5)) {
        parts.push(`  - \`${dep.type} ${dep.name}\` in \`${dep.file}\` (${dep.reason}, Edge: \`${dep.edgeType}\`)`);
      }
    }

    if (data.impactReport.flowSteps.length > 0) {
      parts.push(`\n#### Traced Execution Flow:`);
      const flowText = data.impactReport.flowSteps.map((s) => `${s.entity} (${s.type})`).join(' → ');
      parts.push(`\`${flowText}\``);
    }
  }

  if (data.symbols.length > 0) {
    parts.push(`\n#### Matched AST Symbols:`);
    for (const sym of data.symbols.slice(0, 10)) {
      parts.push(`- \`${sym.kind} ${sym.name}\` in \`${sym.filePath}\` (Lines ${sym.startLine}–${sym.endLine}) [Exported: ${sym.exported}]`);
    }
  }

  if (data.apis.length > 0) {
    parts.push(`\n#### Matched API Routes:`);
    for (const api of data.apis.slice(0, 5)) {
      parts.push(`- \`${api.method} ${api.path}\` → Handler \`${api.handlerName}\` in \`${api.filePath}\` [Confidence: ${api.confidence}]`);
    }
  }

  if (data.databases.length > 0) {
    parts.push(`\n#### Matched Database Models:`);
    for (const db of data.databases.slice(0, 5)) {
      parts.push(`- \`${db.technology.toUpperCase()} ${db.entityType} ${db.name}\` in \`${db.filePath}\``);
    }
  }

  if (data.tests.length > 0) {
    parts.push(`\n#### Matched Tests:`);
    for (const t of data.tests.slice(0, 5)) {
      parts.push(`- \`${t.framework} Test Suite "${t.testName}"\` in \`${t.filePath}\``);
    }
  }

  if (data.relationships.length > 0) {
    parts.push(`\n#### Traced Code Relationships & Provenance:`);
    for (const rel of data.relationships.slice(0, 10)) {
      parts.push(`- \`[${rel.type} / ${rel.confidence}]\` ${rel.provenance.reason} (File: \`${rel.provenance.filePath}\`${rel.provenance.startLine ? `, Line ${rel.provenance.startLine}` : ''})`);
    }
  }

  if (data.semanticMarkdown) {
    parts.push(`\n#### Semantic Code Knowledge:`);
    parts.push(data.semanticMarkdown);
  }

  return parts.join('\n');
}
