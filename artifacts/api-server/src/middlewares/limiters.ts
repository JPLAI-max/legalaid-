import rateLimit from "express-rate-limit";
import { getAuth } from "@clerk/express";
import type { Request } from "express";

/**
 * Key rate-limit buckets by Clerk userId so that all users behind the same
 * NAT / reverse-proxy get independent quotas.  Unauthenticated requests fall
 * back to a fixed "anon" key — they hit requireApiAuth() before any handler
 * runs anyway, so the exact key doesn't matter.
 *
 * Note: validate.keyGeneratorIpFallback is disabled because we intentionally
 * do NOT fall back to req.ip — anon traffic gets a single shared bucket which
 * is fine given it's gated by auth on every real endpoint.
 */
function userKey(req: Request): string {
  const { userId } = getAuth(req);
  return userId ?? "anon";
}

const sharedValidate = {
  keyGeneratorIpFallback: false, // we key by userId, not IP
};

/**
 * General API limiter — applied to all /api routes.
 * 1 500 requests per 15 minutes per user.
 * Intentionally generous so normal browsing / polling never trips it.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 1500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userKey,
  validate: sharedValidate,
  message: { error: "Too many requests. Please slow down and try again shortly." },
  skip: (_req, res) => res.headersSent, // never double-count
});

/**
 * AI limiter — applied only to POST routes that call OpenAI.
 * 30 requests per 15 minutes per user.
 * Method-scoped in app.ts (app.post) so GET reads don't consume quota.
 */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userKey,
  validate: sharedValidate,
  message: { error: "AI request limit reached. Please wait a few minutes before generating more AI content." },
});
