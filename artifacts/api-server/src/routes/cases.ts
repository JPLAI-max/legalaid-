import { Router } from "express";
import { db } from "@workspace/db";
import {
  casesTable,
  evidenceTable,
  timelineEventsTable,
  suggestedEventsTable,
  exportsTable,
} from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireApiAuth } from "../middlewares/requireApiAuth";
import { getAuth } from "@clerk/express";
import { z } from "zod";

const router = Router();

const CreateCaseBodySchema = z.object({
  name: z.string().min(1),
  caseType: z.enum(["custody", "divorce", "contract_dispute", "employment", "landlord_tenant", "other"]),
  parties: z.string().min(1),
  attorneyName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

const UpdateCaseBodySchema = CreateCaseBodySchema.partial();

// List cases
router.get("/cases", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const cases = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.userId, userId))
    .orderBy(casesTable.updatedAt);
  return res.json(cases);
});

// Create case
router.post("/cases", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const body = CreateCaseBodySchema.parse(req.body);
  const [newCase] = await db
    .insert(casesTable)
    .values({ ...body, userId })
    .returning();
  return res.status(201).json(newCase);
});

// Get case
router.get("/cases/:caseId", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const caseId = Number(req.params.caseId);
  const [found] = await db
    .select()
    .from(casesTable)
    .where(and(eq(casesTable.id, caseId), eq(casesTable.userId, userId)));
  if (!found) return res.status(404).json({ error: "Not found" });
  return res.json(found);
});

// Update case
router.patch("/cases/:caseId", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const caseId = Number(req.params.caseId);
  const body = UpdateCaseBodySchema.parse(req.body);
  const [updated] = await db
    .update(casesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(casesTable.id, caseId), eq(casesTable.userId, userId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

// Delete case
router.delete("/cases/:caseId", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const caseId = Number(req.params.caseId);
  await db
    .delete(casesTable)
    .where(and(eq(casesTable.id, caseId), eq(casesTable.userId, userId)));
  return res.status(204).send();
});

// Case stats
router.get("/cases/:caseId/stats", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const caseId = Number(req.params.caseId);
  const [foundCase] = await db
    .select({ id: casesTable.id })
    .from(casesTable)
    .where(and(eq(casesTable.id, caseId), eq(casesTable.userId, userId)));
  if (!foundCase) return res.status(404).json({ error: "Not found" });

  const [evidenceCount] = await db
    .select({ count: count() })
    .from(evidenceTable)
    .where(eq(evidenceTable.caseId, caseId));
  const [eventCount] = await db
    .select({ count: count() })
    .from(timelineEventsTable)
    .where(eq(timelineEventsTable.caseId, caseId));
  const [suggestedCount] = await db
    .select({ count: count() })
    .from(suggestedEventsTable)
    .where(and(eq(suggestedEventsTable.caseId, caseId), eq(suggestedEventsTable.status, "pending")));
  const exportsList = await db
    .select()
    .from(exportsTable)
    .where(eq(exportsTable.caseId, caseId))
    .orderBy(exportsTable.createdAt)
    .limit(1);
  const lastExport = exportsList[0];

  return res.json({
    caseId,
    evidenceCount: Number(evidenceCount?.count ?? 0),
    timelineEventCount: Number(eventCount?.count ?? 0),
    suggestedEventCount: Number(suggestedCount?.count ?? 0),
    exportCount: exportsList.length,
    lastExportStatus: lastExport?.status ?? null,
  });
});

export default router;
