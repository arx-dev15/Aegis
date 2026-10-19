import { ResearcherAgent } from "./researcher.js";
import type { ResearcherModel } from "./researcher.js";
import { researchResultSchema } from "./schema.js";

const fakeModel: ResearcherModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      objective: "Investigate database caching options",
      summary: "Evaluated Redis vs Memcached for session and query caching.",
      findings: [
        {
          id: "finding-1",
          topic: "Redis Persistence",
          finding: "Redis supports key persistence and complex data structures.",
          evidence: "Redis documentation and benchmark tests.",
          source: "https://redis.io/docs",
        },
        {
          id: "finding-2",
          topic: "Memcached Multi-threading",
          finding: "Memcached handles multithreaded key-value memory caching simple blobs.",
          evidence: "Memcached architectural documentation.",
        },
      ],
      constraints: ["Must fit within current memory limits (512MB RAM)."],
      unknowns: ["Network latency between API container and Redis node."],
      risks: ["Cache invalidation bugs could serve stale user data."],
    } as unknown as T;
  },
};

async function main() {
  const researcher = new ResearcherAgent(fakeModel);

  const result = await researcher.research(
    "Investigate database caching options for Aegis API"
  );

  console.log("Researcher result:");
  console.log(JSON.stringify(result, null, 2));

  researchResultSchema.parse(result);

  console.log("✓ Researcher output is valid");
}

main().catch((error) => {
  console.error("Researcher test failed:", error);
  process.exit(1);
});
