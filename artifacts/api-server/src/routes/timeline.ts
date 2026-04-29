import { Router } from "express";
import { db } from "@workspace/db";
import {
  timelineEventsTable,
  eventEvidenceTable,
  evidenceTable,
  casesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@clerk/express";
import { z } from "zod";

const router = Router();

const CreateEventBodySchema = z.object({
  eventDate: z.string().min(1),
  eventTime: z.string().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  attorneyNote: z.string().nullable().optional(),
  people: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
});

const UpdateEventBodySchema = CreateEventBodySchema.partial();

async function verifyCase(userId: string, caseId: number) {
  const [found] = await db
    .select({ id: casesTable.id })
    .from(casesTable)
    .where(and(eq(casesTable.id, caseId), eq(casesTable.userId, userId)));
  return !!found;
}

// List timeline events
router.get("/cases/:caseId/events", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const events = await db
    .select()
    .from(timelineEventsTable)
    .where(eq(timelineEventsTable.caseId, caseId))
    .orderBy(timelineEventsTable.eventDate);
  res.json(events);
});

// Create timeline event
router.post("/cases/:caseId/events", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const body = CreateEventBodySchema.parse(req.body);
  const [created] = await db
    .insert(timelineEventsTable)
    .values({ ...body, caseId, people: body.people ?? [], tags: body.tags ?? [] })
    .returning();
  res.status(201).json(created);
});

// Get timeline event
router.get("/cases/:caseId/events/:eventId", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  const eventId = Number(req.params.eventId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const [found] = await db
    .select()
    .from(timelineEventsTable)
    .where(and(eq(timelineEventsTable.id, eventId), eq(timelineEventsTable.caseId, caseId)));
  if (!found) return res.status(404).json({ error: "Not found" });
  res.json(found);
});

// Update timeline event
router.patch("/cases/:caseId/events/:eventId", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  const eventId = Number(req.params.eventId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const body = UpdateEventBodySchema.parse(req.body);
  const [updated] = await db
    .update(timelineEventsTable)
    .set(body)
    .where(and(eq(timelineEventsTable.id, eventId), eq(timelineEventsTable.caseId, caseId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

// Delete timeline event
router.delete("/cases/:caseId/events/:eventId", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  const eventId = Number(req.params.eventId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  await db
    .delete(timelineEventsTable)
    .where(and(eq(timelineEventsTable.id, eventId), eq(timelineEventsTable.caseId, caseId)));
  res.status(204).send();
});

// List event evidence
router.get("/cases/:caseId/events/:eventId/evidence", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  const eventId = Number(req.params.eventId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const attached = await db
    .select({ evidence: evidenceTable })
    .from(eventEvidenceTable)
    .innerJoin(evidenceTable, eq(eventEvidenceTable.evidenceId, evidenceTable.id))
    .where(eq(eventEvidenceTable.eventId, eventId));
  res.json(attached.map(a => a.evidence));
});

// Attach evidence to event
router.post("/cases/:caseId/events/:eventId/evidence", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  const eventId = Number(req.params.eventId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const { evidenceId } = z.object({ evidenceId: z.number() }).parse(req.body);
  await db
    .insert(eventEvidenceTable)
    .values({ eventId, evidenceId })
    .onConflictDoNothing();
  res.status(201).json({ success: true });
});

// Detach evidence from event
router.delete("/cases/:caseId/events/:eventId/evidence/:evidenceId", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  const eventId = Number(req.params.eventId);
  const evidenceId = Number(req.params.evidenceId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  await db
    .delete(eventEvidenceTable)
    .where(and(eq(eventEvidenceTable.eventId, eventId), eq(eventEvidenceTable.evidenceId, evidenceId)));
  res.status(204).send();
});

export default router;
