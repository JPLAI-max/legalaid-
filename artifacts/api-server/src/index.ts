// validateEnv must be called as early as possible to surface missing secrets
// with a clear diagnostic before any other module tries to use them.
import { validateEnv } from "./lib/env";
validateEnv();

import { runMigrations } from "./lib/migrate";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"]!;
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  logger.error(`Invalid PORT value: "${rawPort}"`);
  process.exit(1);
}

// Run DB migrations before accepting any traffic.
try {
  await runMigrations();
} catch (err) {
  logger.error({ err }, "[startup] DB migration failed — refusing to start");
  process.exit(1);
}

app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
