/**
 * Aegis Repository Intelligence & Engineering CLI (Compatibility Entry Point)
 * 
 * Top-level executable facade delegating to `apps/cli`.
 * Preserves backwards compatibility for all existing scripts, tools, and workflows.
 */

import './apps/cli/env.js';
import {
  mainWithArgs,
  executeNativeRepair,
  resolveTargetWorkspace,
} from './apps/cli/index.js';

export { executeNativeRepair, resolveTargetWorkspace, mainWithArgs };

async function main() {
  await mainWithArgs(process.argv.slice(2));
}

main().catch((err) => {
  console.error('CLI Error:', err);
  process.exit(1);
});
