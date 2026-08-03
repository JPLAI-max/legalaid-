import { Router } from "express";
import { db } from "@workspace/db";
import { evidenceTable } from "@workspace/db";
import { eq, and, ilike, gte, lte } from "drizzle-orm";
import { requireApiAuth } from "../middlewares/requireApiAuth";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { casesTable } from "@workspace/db";

const router = Router({ mergeParams: true });

const CreateEvidenceBodySchema = z.object({
  filename: z.string().min(1),
  fileType: z.string().min(1),
  objectPath: z.string().min(1),
  fileSize: z.number().nullable().optional(),
  detectedDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  people: z.array(z.string()).optional().default([]),
});

const UpdateEvidenceBodySchema = z.object({
  detectedDate: z.string().nullable().optional(),
  processingStatus: z.enum(["pending", "processing", "processed", "failed"]).optional(),
  textPreview: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  people: z.array(z.string()).optional(),
});

async function verifyCase(userId: string, caseId: number) {
  const [found] = await db
    .select({ id: casesTable.id })
    .from(casesTable)
    .where(and(eq(casesTable.id, caseId), eq(casesTable.userId, userId)));
  return !!found;
}

// List evidence
router.get("/cases/:caseId/evidence", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  let query = db.select().from(evidenceTable).where(eq(evidenceTable.caseId, caseId));
  const evidence = await db.select().from(evidenceTable).where(eq(evidenceTable.caseId, caseId));
  
  // Simple filtering
  let results = evidence;
  const { search, fileType } = req.query as Record<string, string>;
  if (search) {
    results = results.filter(e => e.filename.toLowerCase().includes(search.toLowerCase()) ||
      (e.textPreview?.toLowerCase().includes(search.toLowerCase()) ?? false));
  }
  if (fileType) {
    results = results.filter(e => e.fileType === fileType);
  }
  return res.json(results);
});

// Create evidence
router.post("/cases/:caseId/evidence", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const body = CreateEvidenceBodySchema.parse(req.body);
  const [created] = await db
    .insert(evidenceTable)
    .values({ ...body, caseId, tags: body.tags ?? [], people: body.people ?? [] })
    .returning();
  return res.status(201).json(created);
});

// Get evidence
router.get("/cases/:caseId/evidence/:evidenceId", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const caseId = Number(req.params.caseId);
  const evidenceId = Number(req.params.evidenceId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const [found] = await db
    .select()
    .from(evidenceTable)
    .where(and(eq(evidenceTable.id, evidenceId), eq(evidenceTable.caseId, caseId)));
  if (!found) return res.status(404).json({ error: "Not found" });
  return res.json(found);
});

// Update evidence
router.patch("/cases/:caseId/evidence/:evidenceId", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const caseId = Number(req.params.caseId);
  const evidenceId = Number(req.params.evidenceId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const body = UpdateEvidenceBodySchema.parse(req.body);
  const [updated] = await db
    .update(evidenceTable)
    .set(body)
    .where(and(eq(evidenceTable.id, evidenceId), eq(evidenceTable.caseId, caseId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

// Delete evidence
router.delete("/cases/:caseId/evidence/:evidenceId", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const caseId = Number(req.params.caseId);
  const evidenceId = Number(req.params.evidenceId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  await db
    .delete(evidenceTable)
    .where(and(eq(evidenceTable.id, evidenceId), eq(evidenceTable.caseId, caseId)));
  return res.status(204).send();
});

export default router;
