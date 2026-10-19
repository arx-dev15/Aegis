import { TesterAgent } from "./tester.js";
import type { TesterModel } from "./tester.js";
import { testerResultSchema } from "./schema.js";

const fakeModel: TesterModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      task: "Verify Auth Route API",
      summary: "Ran unit & integration tests for POST /api/auth/login.",
      passed: true,
      totalTests: 3,
      passedTests: 3,
      failedTests: 0,
      testRuns: [
        {
          name: "Test 1: Valid credentials return 200 + token",
          passed: true,
          durationMs: 45,
        },
        {
          name: "Test 2: Invalid password returns 401 Unauthorized",
          passed: true,
          durationMs: 30,
        },
        {
          name: "Test 3: Empty body returns 400 Bad Request",
          passed: true,
          durationMs: 25,
        },
      ],
      coverageGaps: ["Rate limiting under brute-force attacks not tested."],
      notes: "All functional API assertions passed.",
    } as unknown as T;
  },
};

async function main() {
  const tester = new TesterAgent(fakeModel);

  const result = await tester.test(
    "Verify Auth Route API"
  );

  console.log("Tester result:");
  console.log(JSON.stringify(result, null, 2));

  testerResultSchema.parse(result);

  console.log("✓ Tester output is valid");
}

main().catch((error) => {
  console.error("Tester test failed:", error);
  process.exit(1);
});
