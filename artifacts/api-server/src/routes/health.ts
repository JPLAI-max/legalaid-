import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

/**
 * GET /healthz
 *
 * Lightweight liveness + readiness probe.
 * Verifies database connectivity so the load balancer / Replit health check
 * can distinguish a running-but-broken server from a healthy one.
 *
 * 200 { status: "ok" }           — server up, database reachable
 * 503 { status: "error", ... }   — server up, database unreachable
 */
router.get("/healthz", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok" });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    res.status(503).json({ status: "error", detail: "Database unreachable", message: detail });
  }
});

export default router;
