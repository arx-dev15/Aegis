/**
 * scripts/build-sandbox-image.ts
 *
 * Builds the canonical AEGIS Node.js 22 sandbox image (aegis-sandbox-node:22).
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const dockerfilePath = path.resolve(__dirname, "../docker/sandbox-node/Dockerfile");
const contextPath = path.resolve(__dirname, "../docker/sandbox-node");

if (!fs.existsSync(dockerfilePath)) {
  console.error(`Dockerfile not found at: ${dockerfilePath}`);
  process.exit(1);
}

console.log("==================================================================");
console.log("  BUILDING AEGIS NODE.JS 22 SANDBOX IMAGE (aegis-sandbox-node:22)");
console.log("==================================================================\n");

try {
  execSync(
    `docker build -t aegis-sandbox-node:22 -t aegis-sandbox-node:latest -f "${dockerfilePath}" "${contextPath}"`,
    { stdio: "inherit" }
  );
  console.log("\n✅ Successfully built and tagged: aegis-sandbox-node:22, aegis-sandbox-node:latest");
} catch (error: any) {
  console.error("\n❌ Failed to build aegis-sandbox-node:22 image:", error.message);
  process.exit(1);
}
