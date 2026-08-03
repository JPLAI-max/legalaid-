import rateLimit from "express-rate-limit";
import { getAuth } from "@clerk/express";
import type { Request } from "express";

/**
 * Key rate-limit buckets by Clerk userId so that all users behind the same
 * NAT / reverse-proxy get independent quotas.  Unauthenticated requests fall
 * back to IP (they will be rejected by requireApiAuth() before the handler
 * fires anyway, so the exact key doesn't matter much).
 */
function userKey(req: Request): string {
  const { userId } = getAuth(req);
  return userId ?? req.ip ?? "anon";
}

/**
 * General API limiter — applied to all /api routes.
 * 1 500 requests per 15 minutes per user.
 * This is intentionally generous so normal browsing and polling never trips it.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 1500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: "Too many requests. Please slow down and try again shortly." },
  skip: (req) => req.path === "/healthz", // never limit the health probe
});

/**
 * AI limiter — applied only to POST routes that call OpenAI.
 * 30 requests per 15 minutes per user.
 * Method-scoped in app.ts (app.post) so plain GET reads don't consume quota.
 */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: "AI request limit reached. Please wait a few minutes before generating more AI content." },
});
