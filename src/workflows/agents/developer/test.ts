import { DeveloperAgent } from "./developer.js";
import type { DeveloperModel } from "./developer.js";
import { developerResultSchema } from "./schema.js";

const fakeModel: DeveloperModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      task: "Implement User Authentication Route",
      summary: "Created POST /api/auth/login endpoint and token generation utility.",
      fileChanges: [
        {
          path: "apps/api/routes/auth.ts",
          action: "add",
          summary: "Added POST /login route with validation.",
          content: "export const authRouter = ...;",
        },
        {
          path: "apps/api/server.ts",
          action: "modify",
          summary: "Registered authRouter in Express app.",
        },
      ],
      commandsExecuted: ["npm run test", "npx tsc --noEmit"],
      status: "completed",
      notes: "Route requires JWT_SECRET env var.",
    } as unknown as T;
  },
};

async function main() {
  const developer = new DeveloperAgent(fakeModel);

  const result = await developer.develop(
    "Implement User Authentication Route"
  );

  console.log("Developer result:");
  console.log(JSON.stringify(result, null, 2));

  developerResultSchema.parse(result);

  console.log("✓ Developer output is valid");
}

main().catch((error) => {
  console.error("Developer test failed:", error);
  process.exit(1);
});
