import { Router } from "express";
import { db } from "@workspace/db";
import { exportsTable, casesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@clerk/express";
import { z } from "zod";

const router = Router();

async function verifyCase(userId: string, caseId: number) {
  const [found] = await db
    .select({ id: casesTable.id })
    .from(casesTable)
    .where(and(eq(casesTable.id, caseId), eq(casesTable.userId, userId)));
  return !!found;
}

// List exports
router.get("/cases/:caseId/exports", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const exports = await db
    .select()
    .from(exportsTable)
    .where(eq(exportsTable.caseId, caseId))
    .orderBy(exportsTable.createdAt);
  res.json(exports);
});

// Create export
router.post("/cases/:caseId/exports", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const { exportType } = z.object({
    exportType: z.enum(["pdf", "zip"]),
  }).parse(req.body);

  const [created] = await db
    .insert(exportsTable)
    .values({ caseId, exportType, status: "pending" })
    .returning();

  // Mark as completed (placeholder — real PDF generation would happen here)
  const [updated] = await db
    .update(exportsTable)
    .set({ status: "completed" })
    .where(eq(exportsTable.id, created.id))
    .returning();

  res.status(201).json(updated);
});

export default router;
