/**
 * apps/cli/env.ts
 *
 * CLI Environment Bootstrap
 * Configures dotenv quietly before any environment-dependent modules load.
 */

import dotenv from 'dotenv';

process.env.DOTENV_CONFIG_QUIET = 'true';
dotenv.config({ quiet: true });

if (!process.env.AEGIS_SANDBOX_IMAGE) {
  process.env.AEGIS_SANDBOX_IMAGE = 'aegis-sandbox-node:22';
}
