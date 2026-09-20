/**
 * graph/nodes/researcherNode.ts
 *
 * Feature 10 — Researcher Agent LangGraph Node
 *
 * Integrates ResearcherAgent into the Aegis LangGraph state machine.
 * Reads task and research from AegisState, invokes ResearcherAgent to generate structured research,
 * and updates state with findings, constraints, risks, and execution status.
 *
 * Integration Bridge 1 (F26 → F10):
 *   When state.workspace is set, this node automatically scans the Repository Intelligence
 *   JSON store for a snapshot matching the workspace path. If found, its AST symbols,
 *   API routes, test suites, and relationship graph are injected as grounded context
 *   into the research prompt so the ResearcherAgent works from real codebase facts.
 */

import path from "path";
import type { AegisState, AegisStateUpdate } from "../state.js";
import { ResearcherAgent } from "../../agents/researcher/researcher.js";
import { memoryManager } from "../../memory/memoryManager.js";
import { JsonRepositoryStore } from "../../repo-intelligence/storage/jsonStore.js";
import { queryRepositoryIntelligence } from "../../repo-intelligence/retrieval/hybridRetriever.js";

import { formatPlanContext } from "../planContext.js";

const repoStore = new JsonRepositoryStore();

/**
 * Attempt to find a stored Repository Intelligence snapshot for the given workspace path.
 * Matches any snapshot whose repository name is contained in the workspace path.
 */
async function loadRepoIntelligenceContext(workspace: string, task: string): Promise<string> {
  try {
    const repos = await repoStore.listRepositories();
    if (!repos || repos.length === 0) return "";

    const normalizedWs = path.resolve(workspace).toLowerCase();

    let matchedRepoId: string | undefined;
    for (const repo of repos) {
      const nameLower = (repo.name || "").toLowerCase();
      const wsBasename = path.basename(normalizedWs).toLowerCase();
      if (
        wsBasename.includes(nameLower) ||
        nameLower.includes(wsBasename) ||
        normalizedWs.includes(nameLower)
      ) {
        matchedRepoId = repo.id;
        break;
      }
    }

    if (!matchedRepoId) return "";

    const snapshot = await repoStore.getSnapshot(matchedRepoId);
    if (!snapshot) return "";

    const result = await queryRepositoryIntelligence({
      snapshot,
      query: task,
      mode: "structural",
    });

    if (result.structuralEvidenceCount === 0) return "";

    return `\n\n=== REPOSITORY INTELLIGENCE (${snapshot.repository.name}) ===\n${result.formattedContext}\n=== END REPO INTELLIGENCE ===`;
  } catch {
    // Best-effort — never block the workflow on a retrieval failure
    return "";
  }
}

/**
 * Creates a researcher node using a provided ResearcherAgent instance or defaults to standard ResearcherAgent.
 */
export function createResearcherNode(agent?: ResearcherAgent) {
  const researcher = agent ?? new ResearcherAgent();

  return async function researcherNode(state: AegisState): Promise<AegisStateUpdate> {
    if (state.approvalDecision && state.research && state.research.trim() !== "") {
      return {
        status: "researching",
        research: state.research,
      };
    }

    if (!state.task || state.task.trim() === "") {
      return {
        status: "failed",
        errors: ["Task input is empty in researcher node"],
      };
    }

    try {
      const memoryContext = state.memoryContext || (state.runId ? memoryManager.getFormattedMemoryContext({ runId: state.runId }) : "");

      // Bridge 1: Inject Repo Intelligence grounding when workspace is available
      const repoContext = state.workspace
        ? await loadRepoIntelligenceContext(state.workspace, state.task)
        : "";

      const baseResearch = [state.research, memoryContext, repoContext]
        .filter(Boolean)
        .join("\n\n")
        .trim();

      const planContext = formatPlanContext(state.plan, "researcher");
      const result = await researcher.research(state.task, baseResearch || undefined, planContext);

      if (state.runId) {
        memoryManager.shortTerm.set(state.runId, "researcher_summary", result.summary, "step_note");
      }

      const findingsFormatted = result.findings
        .map((f) => `- [${f.topic}] ${f.finding} (Evidence: ${f.evidence}${f.source ? `, Source: ${f.source}` : ""})`)
        .join("\n");

      const researchSummary = [
        `Research Objective: ${result.objective}`,
        `Summary: ${result.summary}`,
        `Findings:\n${findingsFormatted}`,
        `Constraints: ${result.constraints.join("; ")}`,
        `Unknowns: ${result.unknowns.join("; ")}`,
        `Risks: ${result.risks.join("; ")}`,
        repoContext ? `\nRepository Intelligence: Active (${state.workspace})` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return {
        status: "researching",
        research: researchSummary,
      };
    } catch (err) {
      return {
        status: "failed",
        errors: [(err as Error).message],
      };
    }
  };
}

/**
 * Default Researcher Agent node function for standard graph workflows.
 */
export const researcherNode = createResearcherNode();


