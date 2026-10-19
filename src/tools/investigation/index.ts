import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { z } from "zod";
import { createAegisTool, StructuredTool } from "../types.js";
import { enforceToolGuardrail } from "../guardrails/index.js";
import { executeRepoExplorer, repoExplorerSchema } from "../repoIntelligence/repoExplorerTool.js";
import { RepositorySnapshot } from "../../intelligence/types.js";
import { memoryManager } from "../../context/memory/memoryManager.js";

const MAX_RESULTS = 40;
const MAX_FILE_BYTES = 32_000;
const MAX_SKILL_BYTES = 20_000;
const MAX_CONTEXT_SNIPPETS = 8;
const MAX_CONTEXT_CHARS = 24_000;
const IGNORED = new Set([".git", "node_modules", ".aegis", ".gemini", ".next", "dist", "build"]);

function workspacePath(workspace: string, relativePath: string): string {
  const guard = enforceToolGuardrail({
    toolName: "filesystem",
    action: "read_file",
    target: relativePath,
    executionMode: "automatic",
  });
  if (!guard.allowed) throw new Error(`[GUARDRAIL-BLOCKED] ${guard.reason}`);
  const root = path.resolve(workspace);
  const resolved = path.resolve(root, relativePath);
  const rootCmp = process.platform === "win32" ? root.toLowerCase() : root;
  const resolvedCmp = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  if (resolvedCmp !== rootCmp && !resolvedCmp.startsWith(`${rootCmp}${path.sep}`)) {
    throw new Error(`Workspace escape rejected: "${relativePath}"`);
  }

  // Canonical realpath containment check (resolves symlinks and junctions)
  try {
    const realRoot = fs.existsSync(root) ? fs.realpathSync(root) : root;
    const realRootCmp = process.platform === "win32" ? realRoot.toLowerCase() : realRoot;
    let current = resolved;
    while (!fs.existsSync(current) && current !== path.dirname(current)) {
      current = path.dirname(current);
    }
    if (fs.existsSync(current)) {
      const realTarget = fs.realpathSync(current);
      const realTargetCmp = process.platform === "win32" ? realTarget.toLowerCase() : realTarget;
      if (realTargetCmp !== realRootCmp && !realTargetCmp.startsWith(`${realRootCmp}${path.sep}`)) {
        throw new Error(`Workspace escape rejected via symlink/junction: "${relativePath}"`);
      }
    }
  } catch (err: any) {
    if (err.message?.includes("Workspace escape rejected")) throw err;
    throw new Error(`Failed workspace containment verification for "${relativePath}": ${err.message}`);
  }
  return resolved;
}

function walk(root: string, current = root, result: string[] = []): string[] {
  if (result.length >= 2000) return result;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(current, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) walk(root, full, result);
    else result.push(path.relative(root, full).replace(/\\/g, "/"));
    if (result.length >= 2000) break;
  }
  return result;
}

const discoverSchema = z.object({
  pattern: z.string().max(120).optional(),
});

const searchSchema = z.object({
  query: z.string().min(1).max(200),
  maxMatches: z.number().int().min(1).max(MAX_RESULTS).optional(),
});

const readSchema = z.object({
  path: z.string().min(1).max(260),
  startLine: z.number().int().min(1).optional(),
  endLine: z.number().int().min(1).optional(),
});

const skillLookupSchema = z.object({
  name: z.string().min(1).max(80),
});

const webSearchSchema = z.object({
  query: z.string().min(1).max(200),
  maxResults: z.number().int().min(1).max(5).optional(),
});


const recallMemorySchema = z.object({
  query: z.string().max(200).optional(),
  category: z.enum(["decision", "preference", "architecture_rule", "pattern", "learned_fact"]).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

const storeMemorySchema = z.object({
  key: z.string().min(1).max(120),
  content: z.string().min(1).max(5000),
  category: z.enum(["decision", "preference", "architecture_rule", "pattern", "learned_fact"]).default("learned_fact"),
});

const webFetchSchema = z.object({
  url: z.string().url().max(2048),
  maxChars: z.number().int().min(200).max(15000).optional(),
});

export interface SourceEvidence {
  path: string;
  line?: number;
  endLine?: number;
  reason: string;
  observedText?: string;
  contentHash?: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  size: number;
  valid: boolean;
  reason?: string;
  tags: string[];
}

export interface EvidenceValidation {
  valid: SourceEvidence[];
  invalid: SourceEvidence[];
  stale: SourceEvidence[];
}

export interface InvestigationContextSelection {
  workspace: string;
  revision?: string;
  snapshotStatus: "fresh" | "missing" | "stale";
  staleReason?: string;
  relevantFiles: string[];
  relevantSymbols: string[];
  skillNames: string[];
  totalBudgetChars: number;
}

function sanitizeSkillText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .trim();
}

function normalizeQueryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && !/^(the|this|that|with|from|into|where|what|when|why|how|does|doesnt|doesn't)$/.test(part));
}

export function getWorkspaceRevision(workspace: string): string | undefined {
  try {
    const gitDir = path.join(workspace, ".git");
    if (!fs.existsSync(gitDir)) return undefined;
    return execFileSync("git", ["-C", workspace, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

export function getWorkspaceFreshnessStatus(workspace: string): { dirty: boolean; details: string[] } {
  const root = path.resolve(workspace);
  const details: string[] = [];
  try {
    const gitDir = path.join(root, ".git");
    if (!fs.existsSync(gitDir)) {
      return { dirty: false, details: ["Non-Git workspace: snapshot freshness cannot be verified from Git HEAD."] };
    }
    const status = execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (!status) {
      return { dirty: false, details: [] };
    }
    const entries = status.split(/\r?\n/).filter(Boolean).slice(0, 5);
    if (entries.length > 0) {
      details.push(...entries);
    }
    return { dirty: true, details };
  } catch {
    return { dirty: false, details: [] };
  }
}

export function resolveInvestigationContext(
  workspace: string,
  question: string,
  snapshot?: RepositorySnapshot | null
): InvestigationContextSelection {
  const root = path.resolve(workspace);
  const revision = getWorkspaceRevision(root);
  const freshness = getWorkspaceFreshnessStatus(root);
  let snapshotStatus: InvestigationContextSelection["snapshotStatus"] = "fresh";
  let staleReason: string | undefined;

  if (!snapshot) {
    snapshotStatus = "missing";
  } else {
    const snapshotRevision = snapshot.repository?.commitSha || snapshot.repository?.analyzedRevision;
    if (!revision) {
      snapshotStatus = "stale";
      staleReason = "Workspace is not backed by a valid Git HEAD, so the snapshot cannot be trusted as current source-of-truth.";
    } else if (snapshotRevision && snapshotRevision !== revision) {
      snapshotStatus = "stale";
      staleReason = `Snapshot revision ${snapshotRevision} differs from live HEAD ${revision}.`;
    } else if (freshness.dirty) {
      snapshotStatus = "stale";
      staleReason = `Live workspace has uncommitted or untracked changes: ${freshness.details.slice(0, 3).join('; ')}`;
    }
  }

  const terms = normalizeQueryTerms(question);
  const relevantFiles: string[] = [];
  const relevantSymbols: string[] = [];

  if (snapshot) {
    const snapshotFiles = snapshot.files
      .filter((file) => file.category === "SOURCE" || file.category === "TEST" || file.category === "CONFIG" || file.category === "DOCUMENTATION")
      .sort((a, b) => a.path.localeCompare(b.path));

    for (const file of snapshotFiles) {
      const haystack = `${file.path} ${file.name} ${file.language}`.toLowerCase();
      if (terms.length === 0 || terms.some((term) => haystack.includes(term))) {
        relevantFiles.push(file.path);
      }
      if (relevantFiles.length >= 12) break;
    }

    for (const symbol of snapshot.symbols) {
      const haystack = `${symbol.name} ${symbol.filePath} ${symbol.kind}`.toLowerCase();
      if (terms.some((term) => haystack.includes(term))) {
        relevantSymbols.push(symbol.name);
      }
      if (relevantSymbols.length >= 12) break;
    }
  }

  const skillNames = discoverSkills(root)
    .filter((skill) => {
      const description = `${skill.name} ${skill.description}`.toLowerCase();
      return terms.length === 0 || terms.some((term) => description.includes(term));
    })
    .slice(0, 3)
    .map((skill) => skill.name);

  return {
    workspace: root,
    revision,
    snapshotStatus,
    staleReason,
    relevantFiles: relevantFiles.slice(0, 12),
    relevantSymbols: relevantSymbols.slice(0, 12),
    skillNames,
    totalBudgetChars: MAX_CONTEXT_CHARS,
  };
}

export function validateSourceEvidence(workspace: string, evidence: SourceEvidence[]): EvidenceValidation {
  const valid: SourceEvidence[] = [];
  const invalid: SourceEvidence[] = [];
  const stale: SourceEvidence[] = [];
  for (const item of evidence) {
    let resolved: string;
    try {
      resolved = workspacePath(workspace, item.path);
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) throw new Error("not a file");
      const lines = fs.readFileSync(resolved, "utf8").split(/\r?\n/);
      const start = item.line ?? 1;
      const end = item.endLine ?? start;
      if (start < 1 || end < start || end > lines.length) throw new Error("invalid line range");
      if (item.observedText !== undefined && !lines[start - 1].includes(item.observedText)) throw new Error("observation no longer matches");
      if (item.contentHash) {
        const hash = crypto.createHash("sha256").update(fs.readFileSync(resolved)).digest("hex");
        if (hash !== item.contentHash) {
          stale.push(item);
          continue;
        }
      }
      valid.push(item);
    } catch {
      invalid.push(item);
    }
  }
  return { valid, invalid, stale };
}

function isBlockedHost(hostname: string): boolean {
  if (!hostname) return true;
  const host = hostname.toLowerCase();
  const blocked = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "169.254.",
    "10.",
    "192.168.",
    "172.16.",
    "172.17.",
    "172.18.",
    "172.19.",
    "172.20.",
    "172.21.",
    "172.22.",
    "172.23.",
    "172.24.",
    "172.25.",
    "172.26.",
    "172.27.",
    "172.28.",
    "172.29.",
    "172.30.",
    "172.31.",
    ".local",
    ".internal",
  ];

  return blocked.some((indicator) => host === indicator || host.includes(indicator) || host.endsWith(`.${indicator}`));
}

export function isWebUrlAllowed(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (!["https:"].includes(url.protocol)) return false;
    if (url.hostname === "" || url.hostname.includes(" ")) return false;
    return !isBlockedHost(url.hostname);
  } catch {
    return false;
  }
}

function getAllowedWebRedirectTarget(location: string | null | undefined): string | undefined {
  if (!location) return undefined;
  if (!isWebUrlAllowed(location)) return undefined;
  return new URL(location).toString();
}

export async function fetchWebPage(url: string, maxChars = 10_000): Promise<{ url: string; title: string; text: string; retrievedAt: string }> {
  if (!isWebUrlAllowed(url)) {
    throw new Error("Web access blocked: only HTTPS destinations outside localhost/private networks are allowed.");
  }
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: { "User-Agent": "AEGIS-Investigate/1.0" },
    signal: AbortSignal.timeout(Number(process.env.AEGIS_WEB_TIMEOUT_MS ?? 8000)),
  });
  if (response.status >= 300 && response.status < 400) {
    const destination = getAllowedWebRedirectTarget(response.headers.get("location"));
    if (!destination) {
      throw new Error("Web redirect blocked: redirected destination is not an allowed HTTPS URL.");
    }
    throw new Error(`Web redirect blocked: ${destination}`);
  }
  if (!response.ok) {
    throw new Error(`Web request failed with status ${response.status}: ${response.statusText}`);
  }
  const text = await response.text();
  const normalized = text.replace(/\s+/g, " ").trim();
  return {
    url,
    title: "Web page",
    text: normalized.slice(0, maxChars),
    retrievedAt: new Date().toISOString(),
  };
}

export async function searchWeb(query: string, maxResults = 5): Promise<{ provider: string; query: string; results: Array<{ title: string; url: string; snippet: string }> }> {
  const configuredProvider = process.env.AEGIS_WEB_SEARCH_URL;
  if (!configuredProvider) {
    throw new Error("No web search provider configured. Set AEGIS_WEB_SEARCH_URL to enable external documentation search.");
  }
  const endpoint = new URL(configuredProvider);
  if (!isWebUrlAllowed(endpoint.toString())) {
    throw new Error("Configured web search provider must be an HTTPS URL outside localhost/private networks.");
  }
  endpoint.searchParams.set("q", query);
  const response = await fetch(endpoint.toString(), {
    method: "GET",
    redirect: "manual",
    headers: { "User-Agent": "AEGIS-Investigate/1.0" },
    signal: AbortSignal.timeout(Number(process.env.AEGIS_WEB_TIMEOUT_MS ?? 8000)),
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Search provider redirect blocked: external redirect target is not allowed.");
  }
  if (!response.ok) {
    throw new Error(`Search provider request failed with status ${response.status}: ${response.statusText}`);
  }
  const payload = await response.json() as Record<string, unknown>;
  const items = Array.isArray(payload.items) ? payload.items as Array<Record<string, unknown>> : Array.isArray(payload.results) ? payload.results as Array<Record<string, unknown>> : [];
  const mapped = items.slice(0, maxResults).map((item) => ({
    title: String(item.title ?? item.name ?? "Result"),
    url: String(item.url ?? item.link ?? ""),
    snippet: String(item.snippet ?? item.description ?? item.summary ?? ""),
  })).filter((entry) => Boolean(entry.url) && isWebUrlAllowed(entry.url));
  if (mapped.length === 0) {
  throw new Error("Search provider returned no safe HTTPS results.");
  }
  return { provider: endpoint.origin, query, results: mapped };
}

export function discoverSkills(workspace: string): SkillInfo[] {
  const root = path.resolve(workspace);
  const skillsDir = path.join(root, ".aegis", "skills");
  if (!fs.existsSync(skillsDir)) return [];

  const entries: SkillInfo[] = [];
  for (const dir of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const file = path.join(skillsDir, dir.name, "SKILL.md");
    if (!fs.existsSync(file)) continue;
    const stat = fs.statSync(file);
    const content = sanitizeSkillText(fs.readFileSync(file, "utf8"));
    const description = content.split(/\n+/).find((line) => line.trim().length > 0)?.trim() ?? "Repository skill";
    const tags = Array.from(new Set((content.match(/#[a-z0-9-]+/gi) ?? []).map((tag) => tag.replace(/^#/, "")))).slice(0, 5);
    const invalidPatterns = [
      /override.*guardrail/i,
      /bypass.*safety/i,
      /ignore.*policy/i,
      /disable.*approval/i,
      /grant.*tool.*permission/i,
      /execute.*automatically/i,
      /run.*command.*automatically/i,
      /unauthorized.*tool/i,
    ];
    const invalid = invalidPatterns.some((pattern) => pattern.test(content));
    entries.push({
      name: dir.name,
      description,
      path: path.relative(root, file),
      size: stat.size,
      valid: !invalid && stat.size <= MAX_SKILL_BYTES,
      reason: invalid ? "Skill content contains policy-bypass instructions." : stat.size > MAX_SKILL_BYTES ? "Skill is too large." : undefined,
      tags,
    });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export function loadSkill(workspace: string, skillName: string): { content: string; skill: SkillInfo } | { error: string } {
  const root = path.resolve(workspace);
  const resolved = path.resolve(root, ".aegis", "skills", skillName, "SKILL.md");
  const rootCmp = process.platform === "win32" ? root.toLowerCase() : root;
  const resolvedCmp = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  if (!resolvedCmp.startsWith(`${rootCmp}${path.sep}`) && resolvedCmp !== rootCmp) {
    return { error: `Workspace containment check failed for skill "${skillName}".` };
  }
  try {
    const realRoot = fs.existsSync(root) ? fs.realpathSync(root) : root;
    if (fs.existsSync(resolved)) {
      const realTarget = fs.realpathSync(resolved);
      const realRootCmp = process.platform === "win32" ? realRoot.toLowerCase() : realRoot;
      const realTargetCmp = process.platform === "win32" ? realTarget.toLowerCase() : realTarget;
      if (realTargetCmp !== realRootCmp && !realTargetCmp.startsWith(`${realRootCmp}${path.sep}`)) {
        return { error: `Workspace containment check failed for skill "${skillName}" (symlink escape).` };
      }
    }
  } catch {
    return { error: `Workspace containment check failed for skill "${skillName}".` };
  }
  if (!fs.existsSync(resolved)) {
    return { error: `Skill "${skillName}" is not available in ${root}.` };
  }
  const content = sanitizeSkillText(fs.readFileSync(resolved, "utf8"));
  const info = discoverSkills(root).find((skill) => skill.name === skillName);
  if (!info || !info.valid) {
    return { error: `Skill "${skillName}" failed validation.` };
  }
  return { content, skill: info };
}

export function validateSkillDocument(workspace: string, raw: string): { valid: boolean; normalized: string; warnings: string[] } {
  const normalized = sanitizeSkillText(raw);
  const warnings: string[] = [];
  const blocked = [
    /override.*guardrail/i,
    /bypass.*safety/i,
    /ignore.*policy/i,
    /grant.*tool.*permission/i,
    /execute.*automatically/i,
    /disable.*approval/i,
    /run.*command.*automatically/i,
    /unauthorized.*tool/i,
  ];
  if (normalized.length > MAX_SKILL_BYTES) warnings.push("Skill exceeds project size limit.");
  if (blocked.some((pattern) => pattern.test(normalized))) {
    warnings.push("Skill content contains instructions that override safety or permissions.");
  }
  return { valid: warnings.length === 0, normalized, warnings };
}

export function createInvestigationTools(workspace: string): StructuredTool[] {
  const root = path.resolve(workspace);
  const discover = createAegisTool(async ({ pattern }) => {
    const guard = enforceToolGuardrail({
      toolName: "filesystem",
      action: "read_dir",
      target: pattern ?? root,
      executionMode: "automatic",
    });
    if (!guard.allowed) throw new Error(`[GUARDRAIL-BLOCKED] ${guard.reason}`);
    const files = walk(root).filter((file) => !pattern || file.toLowerCase().includes(pattern.toLowerCase()));
    return JSON.stringify({ workspace: root, files: files.slice(0, MAX_RESULTS), truncated: files.length >= MAX_RESULTS });
  }, {
    name: "discover_files",
    description: "List relevant files in the selected workspace. Read-only and bounded.",
    schema: discoverSchema,
  });

  const search = createAegisTool(async ({ query, maxMatches }) => {
    const guard = enforceToolGuardrail({
      toolName: "filesystem",
      action: "search",
      target: query,
      executionMode: "automatic",
    });
    if (!guard.allowed) throw new Error(`[GUARDRAIL-BLOCKED] ${guard.reason}`);
    const matches: Array<{ path: string; line: number; text: string }> = [];
    for (const relative of walk(root)) {
      if (matches.length >= (maxMatches ?? MAX_RESULTS)) break;
      const full = workspacePath(root, relative);
      let content: string;
      try {
        content = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      for (const [index, line] of lines.entries()) {
        if (matches.length < (maxMatches ?? MAX_RESULTS) && line.toLowerCase().includes(query.toLowerCase())) {
          matches.push({ path: relative, line: index + 1, text: line.slice(0, 500) });
        }
      }
    }
    return JSON.stringify({ query, matches, truncated: matches.length >= (maxMatches ?? MAX_RESULTS) });
  }, {
    name: "search_repository",
    description: "Search bounded text content in the selected workspace. Read-only.",
    schema: searchSchema,
  });

  const read = createAegisTool(async ({ path: relativePath, startLine, endLine }) => {
    const full = workspacePath(root, relativePath);
    if (!fs.existsSync(full)) {
          throw new Error(`File not found: "${relativePath}" in workspace.`);
        }
        const stat = fs.statSync(full);
    if (!stat.isFile()) throw new Error(`Cannot read non-file path "${relativePath}".`);
    if (stat.size > MAX_FILE_BYTES) throw new Error(`File exceeds bounded read limit of ${MAX_FILE_BYTES} bytes.`);
    const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
    const from = (startLine ?? 1) - 1;
    const to = Math.min(endLine ?? lines.length, from + 200);
    if (to < from) throw new Error("endLine must be greater than or equal to startLine.");
    return JSON.stringify({
      path: relativePath,
      startLine: from + 1,
      endLine: to,
      content: lines.slice(from, to).join("\n"),
      contentHash: crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex"),
    });
  }, {
    name: "read_source_file",
    description: "Read a bounded source file or line range from the selected workspace.",
    schema: readSchema,
  });

  const listSkills = createAegisTool(async () => {
    const skills = discoverSkills(root);
    return JSON.stringify({
      workspace: root,
      count: skills.length,
      skills: skills.map(({ name, description, path, tags, valid, reason }) => ({ name, description, path, tags, valid, reason })),
    });
  }, {
    name: "list_available_skills",
    description: "List repository-local skill instructions that are relevant to the current investigation.",
    schema: z.object({}),
  });

  const loadSkillTool = createAegisTool(async ({ name }) => {
    const loaded = loadSkill(root, name);
    if ("error" in loaded) {
      throw new Error(loaded.error);
    }
    return JSON.stringify({
      name: loaded.skill.name,
      description: loaded.skill.description,
      path: loaded.skill.path,
      content: loaded.content,
      provenance: { source: "workspace", workspace: root },
    });
  }, {
    name: "load_skill",
    description: "Load a selected repository-local skill as bounded, project-provided guidance for the active investigation.",
    schema: skillLookupSchema,
  });

  const webSearch = createAegisTool(async ({ query, maxResults }) => {
    const result = await searchWeb(query, maxResults ?? 3);
    return JSON.stringify(result, null, 2);
  }, {
    name: "search_web",
    description: "Search a configured external documentation source for technical references. Requires AEGIS_WEB_SEARCH_URL to be set.",
    schema: webSearchSchema,
  });

  const webFetch = createAegisTool(async ({ url, maxChars }) => {
    const page = await fetchWebPage(url, maxChars ?? 10_000);
    return JSON.stringify(page, null, 2);
  }, {
    name: "fetch_web_page",
    description: "Retrieve a bounded web page for evidence review; only HTTPS resources outside local/private networks are allowed.",
    schema: webFetchSchema,
  });

  const recallMemory = createAegisTool(async ({ query, category, limit }) => {
    const projectId = path.basename(root);
    const records = memoryManager.longTerm.query({ projectId, category: category as any, limit: limit ?? 5 });
    const filtered = query
      ? records.filter((r) => r.key.toLowerCase().includes(query.toLowerCase()) || r.content.toLowerCase().includes(query.toLowerCase()))
      : records;
    return JSON.stringify({
      workspace: root,
      projectId,
      count: filtered.length,
      records: filtered.map((r) => ({ key: r.key, category: r.category, content: r.content })),
    });
  }, {
    name: "recall_memory",
    description: "Recall persistent project knowledge, architectural decisions, and conventions for the active workspace.",
    schema: recallMemorySchema,
  });

  const storeMemory = createAegisTool(async ({ key, content, category }) => {
    const projectId = path.basename(root);
    const cat = (category || "learned_fact") as any;
    const existing = memoryManager.longTerm.getByKey(key, cat, projectId);
    let saved;
    if (existing) {
      saved = memoryManager.longTerm.update(existing.id, { content, category: cat }) ?? existing;
    } else {
      saved = memoryManager.longTerm.add({
        projectId,
        key,
        content,
        category: cat,
        metadata: {},
      });
    }
    return JSON.stringify({
      saved: true,
      projectId,
      key: saved.key,
      category: saved.category,
      content: saved.content,
    });
  }, {
    name: "store_memory",
    description: "Store persistent architectural decisions, conventions, or verified insights for the active workspace.",
    schema: storeMemorySchema,
  });

  return [discover, search, read, listSkills, loadSkillTool, recallMemory, storeMemory, webSearch, webFetch];
}

export function createRepositoryIntelligenceTool(repoId: string): StructuredTool {
  return createAegisTool(
    async (input) => executeRepoExplorer({ ...input, repoId }),
    {
      name: "repository_intelligence",
      description: "Inspect indexed symbols, relationships, flow, and impact evidence for the selected repository.",
      schema: repoExplorerSchema.omit({ repoId: true }),
    }
  );
}
