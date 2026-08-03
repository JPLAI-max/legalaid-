import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { db } from "@workspace/db";

/**
 * Run pending Drizzle migrations before the server starts accepting traffic.
 *
 * The esbuild build step copies lib/db/migrations/ → dist/migrations/ so the
 * migrations folder is always at path.join(__dirname, "migrations").
 *
 * The initial migration SQL is written to be idempotent (IF NOT EXISTS /
 * DO … EXCEPTION WHEN duplicate_object blocks) so it is safe to run against
 * a database that already has the schema, e.g. when upgrading from a codebase
 * that was previously using drizzle-kit push instead of migrate.
 */
export async function runMigrations(): Promise<void> {
  // __dirname is injected by the esbuild banner; equals the dist/ directory.
  const migrationsFolder = path.join(__dirname, "migrations");
  await migrate(db, { migrationsFolder });
  console.info("[startup] DB migrations applied successfully.");
}
