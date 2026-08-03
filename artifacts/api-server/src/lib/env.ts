/**
 * Startup environment validation.
 *
 * Call validateEnv() as the FIRST thing in index.ts — before any imports
 * that touch process.env — so a missing variable produces a clear error
 * listing everything that's wrong, rather than a cryptic runtime crash.
 */

const REQUIRED_VARS: { key: string; description: string }[] = [
  { key: "DATABASE_URL",                  description: "PostgreSQL connection string" },
  { key: "CLERK_PUBLISHABLE_KEY",         description: "Clerk publishable key (pk_live_... or pk_test_...)" },
  { key: "CLERK_SECRET_KEY",              description: "Clerk secret key (sk_live_... or sk_test_...)" },
  { key: "PRIVATE_OBJECT_DIR",            description: "Object Storage private dir (e.g. gs://bucket/objects)" },
  { key: "PUBLIC_OBJECT_SEARCH_PATHS",    description: "Object Storage public search paths, comma-separated" },
  { key: "DEFAULT_OBJECT_STORAGE_BUCKET_ID", description: "Replit Object Storage bucket ID" },
  { key: "AI_INTEGRATIONS_OPENAI_BASE_URL",  description: "Replit AI Integrations OpenAI base URL" },
  { key: "AI_INTEGRATIONS_OPENAI_API_KEY",   description: "Replit AI Integrations OpenAI API key" },
];

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter(({ key }) => !process.env[key]);

  if (missing.length === 0) return;

  const lines = missing.map(({ key, description }) => `  ${key.padEnd(40)} — ${description}`);
  console.error(
    `\n╔══════════════════════════════════════════════════════════════╗\n` +
    `║  STARTUP FAILED: missing required environment variables      ║\n` +
    `╚══════════════════════════════════════════════════════════════╝\n` +
    `\n${lines.join("\n")}\n\n` +
    `Set the above variables (Replit Secrets panel) and restart.\n`,
  );
  process.exit(1);
}
