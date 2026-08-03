import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireApiAuth } from "../middlewares/requireApiAuth";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { evidenceTable, exportsTable, casesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * Auth required: only signed-in users may request upload slots.
 */
router.post(
  "/storage/uploads/request-url",
  requireApiAuth(),
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * Unconditionally public — no auth required.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
      return;
    }

    res.end();
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve private object entities from PRIVATE_OBJECT_DIR.
 *
 * Security:
 *   1. requireApiAuth() — 401 if no valid Clerk session cookie is present.
 *   2. Ownership check — the objectPath must appear in an evidence row OR an
 *      export record belonging to a case owned by the authenticated user.
 *      Any unmatched path returns 404 (not 403) to avoid leaking path existence.
 *
 * Browser callers (img tags, anchor downloads) authenticate automatically
 * because Clerk writes a session cookie sent on every same-origin request.
 */
router.get(
  "/storage/objects/*path",
  requireApiAuth(),
  async (req: Request, res: Response) => {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const userId = getAuth(req).userId!;

    try {
      // Run both ownership queries in parallel.
      const [evidenceRows, exportRows] = await Promise.all([
        db
          .select({ id: evidenceTable.id })
          .from(evidenceTable)
          .innerJoin(casesTable, eq(evidenceTable.caseId, casesTable.id))
          .where(
            and(
              eq(evidenceTable.objectPath, objectPath),
              eq(casesTable.userId, userId),
            ),
          )
          .limit(1),

        db
          .select({ id: exportsTable.id })
          .from(exportsTable)
          .innerJoin(casesTable, eq(exportsTable.caseId, casesTable.id))
          .where(
            and(
              eq(exportsTable.objectPath, objectPath),
              eq(casesTable.userId, userId),
            ),
          )
          .limit(1),
      ]);

      if (evidenceRows.length === 0 && exportRows.length === 0) {
        // 404 rather than 403 so paths are not leaked.
        res.status(404).json({ error: "Not found" });
        return;
      }

      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      const response = await objectStorageService.downloadObject(objectFile);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
        return;
      }

      res.end();
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        req.log.warn({ err: error }, "Object not found in storage");
        res.status(404).json({ error: "Not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving object");
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;
