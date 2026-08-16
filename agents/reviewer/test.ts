import { ReviewerAgent } from "./reviewer.js";
import type { ReviewerModel } from "./reviewer.js";
import { reviewerResultSchema } from "./schema.js";

const fakeModel: ReviewerModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      task: "Review Auth Middleware Implementation",
      summary: "Code quality review for auth middleware changes.",
      approved: true,
      findings: [
        {
          id: "finding-1",
          file: "apps/api/middleware/auth.ts",
          severity: "suggestion",
          issue: "Hardcoded bearer token string prefix comparison could use constant.",
          recommendation: "Extract 'Bearer ' to an AUTH_HEADER_PREFIX constant.",
        },
      ],
      acceptedAspects: [
        "Clean separation of token decoding logic.",
        "Proper error status code propagation.",
      ],
      recommendation: "approve",
      notes: "Code meets quality standards.",
    } as unknown as T;
  },
};

async function main() {
  const reviewer = new ReviewerAgent(fakeModel);

  const result = await reviewer.review(
    "Review Auth Middleware Implementation"
  );

  console.log("Reviewer result:");
  console.log(JSON.stringify(result, null, 2));

  reviewerResultSchema.parse(result);

  console.log("✓ Reviewer output is valid");
}

main().catch((error) => {
  console.error("Reviewer test failed:", error);
  process.exit(1);
});
