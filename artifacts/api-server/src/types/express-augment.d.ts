/**
 * Express type augmentations for this project.
 *
 * 1. req.auth — routes use requireAuth() from @clerk/express which attaches
 *    auth as a plain object. New Clerk types declare it as a function, so we
 *    redeclare it here via the global Express namespace (same mechanism Clerk's
 *    own env.d.ts uses for Request) so existing routes compile without change.
 *
 * 2. res.json() returning void — early-exit patterns like
 *    `return res.status(404).json(...)` return the result of json(), which is
 *    typed as `this` (Response) in express-serve-static-core. That makes
 *    TypeScript infer the handler returns Promise<Response | undefined> and
 *    raise TS7030 "Not all code paths return a value" when other paths end
 *    with a bare `res.json()`. Narrowing json() to void makes all paths
 *    consistent without touching every route file.
 */

// -- 1. req.auth augmentation (global Express.Request namespace) --------------
declare global {
  namespace Express {
    interface Request {
      auth: {
        userId: string | null;
        sessionId: string | null;
        sessionClaims: Record<string, unknown> | null;
        getToken: () => Promise<string | null>;
      };
    }
  }
}

// -- 2. res.json() void return (express-serve-static-core module augment) -----
declare module "express-serve-static-core" {
  interface Response<
    ResBody = any, // eslint-disable-line @typescript-eslint/no-explicit-any
    LocalsObj extends Record<string, any> = Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
    StatusCode extends number = number,
  > {
    json(body?: ResBody): void;
  }
}

export {};
