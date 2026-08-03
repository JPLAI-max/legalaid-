import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { db } from "@workspace/db";

/**
 * Run pending Drizzle migrations before the server starts accepting traffic.
 *
 * The migrations folder lives at lib/db/migrations/ in the workspace root.
 * Both dev (running from source) and production (running compiled dist/)
 * share the same CWD — the workspace root — so this path works in both modes.
 */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(process.cwd(), "lib/db/migrations");
  await migrate(db, { migrationsFolder });
  console.info("[startup] DB migrations applied successfully.");
}
