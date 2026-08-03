import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { generalLimiter, aiLimiter } from "./middlewares/limiters";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

// ── Request logging ───────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── Clerk proxy + core middleware ─────────────────────────────────────────────
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// ── Rate limiters — registered BEFORE routers so they always fire ─────────────
//
// General: 1 500 req / 15 min per user (keyed by Clerk userId, not IP).
app.use("/api", generalLimiter);

// AI: 30 req / 15 min per user — method-scoped to POST so GET reads
// (transcript list, summary fetch, etc.) don't consume the AI quota.
app.post("/api/cases/:caseId/ai/generate-summary", aiLimiter);
app.post("/api/cases/:caseId/ai/suggest-events", aiLimiter);
app.post("/api/cases/:caseId/text-messages/upload", aiLimiter);
app.post(
  "/api/cases/:caseId/text-messages/threads/:threadId/suggest",
  aiLimiter,
);

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Production: serve the built React frontend + SPA fallback ─────────────────
// The frontend is built to artifacts/casebinder-ai/dist/public/ by the
// production build step.  All non-/api paths fall through to index.html so
// client-side routing (wouter) works after a hard refresh.
if (process.env.NODE_ENV === "production") {
  // From dist/index.mjs: __dirname = artifacts/api-server/dist/
  // → ../../casebinder-ai/dist/public = artifacts/casebinder-ai/dist/public ✓
  const frontendDist = path.join(__dirname, "../../casebinder-ai/dist/public");
  app.use(express.static(frontendDist));
  // Express 5 / path-to-regexp v8 dropped bare "*" wildcards.
  // Use a regex catch-all for the SPA fallback instead.
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// ── Global JSON error handler ─────────────────────────────────────────────────
// Must be the last middleware. Express identifies error handlers by the
// four-argument signature (err, req, res, next).
// In Express 5, async route errors are forwarded here automatically.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled route error");
  const status =
    (err as unknown as Record<string, unknown>)["status"] ??
    (err as unknown as Record<string, unknown>)["statusCode"] ??
    500;
  if (!res.headersSent) {
    res.status(Number(status)).json({ error: err.message || "Internal server error" });
  }
});

export default app;
