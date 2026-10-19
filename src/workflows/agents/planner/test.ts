import { PlannerAgent } from "./planner.js";
import type { PlannerModel } from "./planner.js";
import { plannerResultSchema } from "./schema.js";

const fakeModel: PlannerModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      goal: "Add authentication",
      summary: "Implement secure user authentication.",
      steps: [
        {
          id: "step-1",
          title: "Inspect existing authentication",
          description: "Understand the current authentication architecture.",
          dependencies: [],
          verification: "Confirm the existing authentication flow.",
        },
        {
          id: "step-2",
          title: "Implement authentication changes",
          description: "Add the required authentication functionality.",
          dependencies: ["step-1"],
          verification: "Run authentication tests.",
        },
      ],
      risks: [
        "Existing authentication behavior may be affected.",
      ],
      verificationStrategy: [
        "Run unit tests.",
        "Run integration tests.",
      ],
    } as unknown as T;
  },
};

async function main() {
  const planner = new PlannerAgent(fakeModel);

  const result = await planner.plan(
    "Add authentication to the application"
  );

  console.log("Planner result:");
  console.log(JSON.stringify(result, null, 2));

  plannerResultSchema.parse(result);

  console.log("✓ Planner output is valid");
}

main().catch((error) => {
  console.error("Planner test failed:", error);
  process.exit(1);
});