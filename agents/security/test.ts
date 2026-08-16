import { SecurityAgent } from "./security.js";
import type { SecurityModel } from "./security.js";
import { securityResultSchema } from "./schema.js";

const fakeModel: SecurityModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      task: "Audit Auth Middleware Implementation",
      summary: "Security audit completed. No critical injection or secret exposure issues found.",
      secure: true,
      vulnerabilities: [
        {
          id: "sec-1",
          component: "apps/api/middleware/auth.ts",
          severity: "low",
          vulnerability: "Verbose auth error details",
          evidence: "Error message exposes specific internal JWT validation exception.",
          impact: "Slight information disclosure regarding token validation mechanism.",
          remediation: "Sanitize auth error response strings to generic 'Unauthorized'.",
          confidence: "high",
        },
      ],
      recommendations: [
        "Enforce strict HTTPS header checks.",
        "Add rate limiting on token endpoint.",
      ],
      notes: "Implementation meets baseline security requirements.",
    } as unknown as T;
  },
};

async function main() {
  const securityAgent = new SecurityAgent(fakeModel);

  const result = await securityAgent.audit(
    "Audit Auth Middleware Implementation"
  );

  console.log("Security result:");
  console.log(JSON.stringify(result, null, 2));

  securityResultSchema.parse(result);

  console.log("✓ Security output is valid");
}

main().catch((error) => {
  console.error("Security test failed:", error);
  process.exit(1);
});
