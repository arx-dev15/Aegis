/**
 * scripts/testDockerIntegration.ts
 *
 * AEGIS Real Docker Integration Test Runner
 *
 * Dedicated live container execution verification command.
 * Strictly tests the live Docker daemon:
 * - Checks Docker daemon connectivity via RealDockerExecutor.isAvailable().
 * - If Docker is unavailable, immediately exits with code 1 and outputs
 *   REAL_CONTAINER_VALIDATION_BLOCKED: Docker daemon unreachable.
 *   Never silently reports skipped tests as passed.
 * - If Docker is available, executes tests/acceptance/real-docker-sandbox.acceptance.test.ts.
 */

import { execSync } from "child_process";
import { RealDockerExecutor, setContainerExecutor } from "../src/tools/terminal/index.js";

async function runDockerIntegration(): Promise<void> {
  console.log("==================================================================");
  console.log("  AEGIS DEDICATED REAL DOCKER INTEGRATION TEST RUNNER");
  console.log("==================================================================\n");

  const executor = new RealDockerExecutor();
  setContainerExecutor(executor);

  console.log("Probing live Docker daemon connectivity...");
  const avail = await executor.isAvailable();
  if (!avail.available) {
    console.error(`\n❌ REAL_CONTAINER_VALIDATION_BLOCKED: Docker daemon unreachable: ${avail.error || "Daemon not running"}`);
    console.error("Dedicated Docker integration tests cannot run without an active Docker daemon.");
    console.error("Failing closed: Tests are NOT reported as passed.\n");
    process.exit(1);
  }

  console.log("✅ Live Docker daemon is operational and responsive.");
  console.log("Executing live Docker acceptance suite...\n");

  try {
    execSync("npx tsx tests/acceptance/real-docker-sandbox.acceptance.test.ts", {
      stdio: "inherit",
      env: {
        ...process.env,
        AEGIS_SANDBOX_IMAGE: process.env.AEGIS_SANDBOX_IMAGE || "aegis-sandbox-node:22",
      },
    });
    console.log("\n==================================================================");
    console.log("  DEDICATED REAL DOCKER INTEGRATION SUITE PASSED SUCCESSFULLY! ✅");
    console.log("==================================================================\n");
  } catch (err: any) {
    console.error("\n❌ Dedicated Docker integration suite encountered failures.");
    process.exit(1);
  }
}

runDockerIntegration();
