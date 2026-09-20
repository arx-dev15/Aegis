/**
 * demoTerminal.ts
 *
 * AEGIS FEATURE 28 — CONTROLLED HOST EXECUTION USER DEMONSTRATION
 *
 * Usage:
 *   npx tsx demoTerminal.ts
 *   npx tsx demoTerminal.ts safe
 *   npx tsx demoTerminal.ts block
 *   npx tsx demoTerminal.ts approval
 *   npx tsx demoTerminal.ts timeout
 *   npx tsx demoTerminal.ts secret
 */

import { runCommand } from "./tools/terminal/index.js";

async function main() {
  const arg = process.argv[2] || "all";

  console.log("\n================================================================");
  console.log("  AEGIS — FEATURE 28: CONTROLLED HOST EXECUTION DEMO");
  console.log("================================================================\n");

  if (arg === "all" || arg === "safe") {
    console.log("----------------------------------------------------------------");
    console.log("1. DEMO: Safe Command Execution (ALLOW Policy)");
    console.log("   Command: node --version");
    console.log("----------------------------------------------------------------");
    const res = await runCommand("node --version", { cwd: process.cwd() });
    console.log("Result:");
    console.log(JSON.stringify(res, null, 2));
    console.log("");
  }

  if (arg === "all" || arg === "block") {
    console.log("----------------------------------------------------------------");
    console.log("2. DEMO: Blocked Dangerous Command (BLOCK Policy)");
    console.log("   Command: rm -rf /");
    console.log("----------------------------------------------------------------");
    const res = await runCommand("rm -rf /", { cwd: process.cwd() });
    console.log("Result (Notice: blocked=true, command NEVER spawned):");
    console.log(JSON.stringify(res, null, 2));
    console.log("");
  }

  if (arg === "all" || arg === "approval") {
    console.log("----------------------------------------------------------------");
    console.log("3. DEMO: Risky Command Requiring Human Approval (REQUIRE_APPROVAL)");
    console.log("   Command: python script.py");
    console.log("----------------------------------------------------------------");
    const res = await runCommand("python script.py", {
      cwd: process.cwd(),
      executionMode: "semi-auto",
    });
    console.log("Result (Notice: approvalRequired=true, creates ApprovalRequest):");
    console.log(JSON.stringify(res, null, 2));
    console.log("");
  }

  if (arg === "all" || arg === "timeout") {
    console.log("----------------------------------------------------------------");
    console.log("4. DEMO: Hanging Command Timeout & Process Cleanup");
    console.log("   Command: node -e process.stdin.resume() (Timeout: 2000ms)");
    console.log("----------------------------------------------------------------");
    const startTime = Date.now();
    const res = await runCommand("node -e process.stdin.resume()", {
      cwd: process.cwd(),
      timeoutMs: 2000,
      executionMode: "automatic",
    });
    const elapsed = Date.now() - startTime;
    console.log(`Result (Elapsed: ${elapsed}ms, timedOut=true, exitCode=124):`);
    console.log(JSON.stringify(res, null, 2));
    console.log("");
  }

  if (arg === "all" || arg === "secret") {
    console.log("----------------------------------------------------------------");
    console.log("5. DEMO: Secret Protection & Token Masking");
    console.log("   Command printing GitHub PAT: ghp_123456789012345678901234567890123456");
    console.log("----------------------------------------------------------------");
    const res = await runCommand(
      "node -e process.stdout.write(Buffer.from([70,111,117,110,100,32,116,111,107,101,110,58,32,103,104,112,95,49,50,51,52,53,54,55,56,57,48,49,50,51,52,53,54,55,56,57,48,49,50,51,52,53,54,55,56,57,48,49,50,51,52,53,54]))",
      { cwd: process.cwd(), executionMode: "automatic" }
    );
    console.log("Result (Notice: Token replaced with ghp_***MASKED***):");
    console.log(JSON.stringify(res, null, 2));
    console.log("");
  }

  console.log("================================================================");
  console.log("  DEMO COMPLETED SUCCESSFULLY");
  console.log("================================================ happier\n");
}

main().catch(console.error);
