import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

/**
 * Drop-in replacement for Clerk's requireAuth() that is suitable for JSON API
 * routes. Unlike requireAuth(), which redirects unauthenticated browser
 * clients to the sign-in page (302), this middleware always returns 401 JSON
 * so that API callers — and security scanners — receive a proper error instead
 * of following a redirect to a UI login page.
 *
 * Must be used AFTER clerkMiddleware() has run (i.e. app.use(clerkMiddleware()))
 * so that getAuth(req) can read the already-parsed session.
 */
export function requireApiAuth() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}
