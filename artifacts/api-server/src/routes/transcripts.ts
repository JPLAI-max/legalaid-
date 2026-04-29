import { Router } from "express";
import { db } from "@workspace/db";
import {
  transcriptsTable,
  suggestedEventsTable,
  timelineEventsTable,
  caseSummariesTable,
  casesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

async function verifyCase(userId: string, caseId: number) {
  const [found] = await db
    .select({ id: casesTable.id })
    .from(casesTable)
    .where(and(eq(casesTable.id, caseId), eq(casesTable.userId, userId)));
  return found ?? null;
}

// List transcripts
router.get("/cases/:caseId/transcripts", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const transcripts = await db
    .select()
    .from(transcriptsTable)
    .where(eq(transcriptsTable.caseId, caseId))
    .orderBy(transcriptsTable.createdAt);
  res.json(transcripts);
});

// Create transcript
router.post("/cases/:caseId/transcripts", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const body = z.object({
    content: z.string().min(1),
    source: z.enum(["typed", "microphone"]),
  }).parse(req.body);

  const [created] = await db
    .insert(transcriptsTable)
    .values({ ...body, caseId })
    .returning();
  res.status(201).json(created);
});

// Update transcript
router.patch("/cases/:caseId/transcripts/:transcriptId", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  const transcriptId = Number(req.params.transcriptId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const { content } = z.object({ content: z.string() }).parse(req.body);
  const [updated] = await db
    .update(transcriptsTable)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(transcriptsTable.id, transcriptId), eq(transcriptsTable.caseId, caseId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

// Generate case summary
router.post("/cases/:caseId/ai/generate-summary", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  const found = await verifyCase(userId, caseId);
  if (!found) return res.status(404).json({ error: "Case not found" });

  const { transcriptId } = z.object({
    transcriptId: z.number(),
    additionalContext: z.string().nullable().optional(),
  }).parse(req.body);

  const [transcript] = await db
    .select()
    .from(transcriptsTable)
    .where(and(eq(transcriptsTable.id, transcriptId), eq(transcriptsTable.caseId, caseId)));
  if (!transcript) return res.status(404).json({ error: "Transcript not found" });

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      {
        role: "system",
        content: `You are a neutral legal document assistant. Generate a factual, neutral case summary from the user's narrative. Do not provide legal advice. Focus on facts, dates, events, and parties involved. Keep it professional and concise.`,
      },
      {
        role: "user",
        content: `Case narrative:\n\n${transcript.content}\n\nGenerate a neutral, factual case summary suitable for attorney review.`,
      },
    ],
    max_completion_tokens: 1500,
  });

  const summary = completion.choices[0]?.message?.content ?? "";
  res.json({ summary, suggestedTitle: null });
});

// Suggest timeline events
router.post("/cases/:caseId/ai/suggest-events", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const { transcriptId } = z.object({ transcriptId: z.number() }).parse(req.body);
  const [transcript] = await db
    .select()
    .from(transcriptsTable)
    .where(and(eq(transcriptsTable.id, transcriptId), eq(transcriptsTable.caseId, caseId)));
  if (!transcript) return res.status(404).json({ error: "Transcript not found" });

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      {
        role: "system",
        content: `You are a legal timeline assistant. Extract specific events from the narrative and return them as a JSON array. Each event should have: estimatedDate (ISO date string or null), title (short), description (factual), people (array of names), confidenceLevel ("low"|"medium"|"high"), suggestedSearchTerms (array of strings to find supporting evidence). Return ONLY valid JSON array, no markdown.`,
      },
      {
        role: "user",
        content: `Extract timeline events from this case narrative:\n\n${transcript.content}`,
      },
    ],
    max_completion_tokens: 2000,
  });

  let events = [];
  try {
    const content = completion.choices[0]?.message?.content ?? "[]";
    events = JSON.parse(content);
  } catch {
    events = [];
  }

  // Save suggested events
  const saved = [];
  for (const event of events) {
    const [inserted] = await db
      .insert(suggestedEventsTable)
      .values({
        caseId,
        estimatedDate: event.estimatedDate ?? null,
        title: event.title ?? "Untitled Event",
        description: event.description ?? "",
        people: event.people ?? [],
        confidenceLevel: event.confidenceLevel ?? "medium",
        suggestedSearchTerms: event.suggestedSearchTerms ?? [],
        status: "pending",
      })
      .returning();
    saved.push(inserted);
  }

  res.json(saved);
});

// List suggested events
router.get("/cases/:caseId/suggested-events", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const events = await db
    .select()
    .from(suggestedEventsTable)
    .where(eq(suggestedEventsTable.caseId, caseId))
    .orderBy(suggestedEventsTable.createdAt);
  res.json(events);
});

// Accept suggested event → promote to timeline
router.post("/cases/:caseId/suggested-events/:suggestedEventId/accept", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  const suggestedId = Number(req.params.suggestedEventId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const [suggested] = await db
    .select()
    .from(suggestedEventsTable)
    .where(and(eq(suggestedEventsTable.id, suggestedId), eq(suggestedEventsTable.caseId, caseId)));
  if (!suggested) return res.status(404).json({ error: "Not found" });

  const [created] = await db
    .insert(timelineEventsTable)
    .values({
      caseId,
      eventDate: suggested.estimatedDate ?? new Date().toISOString().split("T")[0],
      title: suggested.title,
      description: suggested.description,
      people: suggested.people,
      tags: [],
    })
    .returning();

  await db
    .update(suggestedEventsTable)
    .set({ status: "accepted" })
    .where(eq(suggestedEventsTable.id, suggestedId));

  res.status(201).json(created);
});

// Ignore suggested event
router.post("/cases/:caseId/suggested-events/:suggestedEventId/ignore", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  const suggestedId = Number(req.params.suggestedEventId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  await db
    .update(suggestedEventsTable)
    .set({ status: "ignored" })
    .where(and(eq(suggestedEventsTable.id, suggestedId), eq(suggestedEventsTable.caseId, caseId)));

  res.json({ success: true });
});

// Get case summary
router.get("/cases/:caseId/summary", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const [summary] = await db
    .select()
    .from(caseSummariesTable)
    .where(eq(caseSummariesTable.caseId, caseId));
  if (!summary) return res.status(404).json({ error: "No summary yet" });
  res.json(summary);
});

// Save case summary
router.put("/cases/:caseId/summary", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const { content } = z.object({ content: z.string().min(1) }).parse(req.body);

  const [existing] = await db
    .select()
    .from(caseSummariesTable)
    .where(eq(caseSummariesTable.caseId, caseId));

  let summary;
  if (existing) {
    [summary] = await db
      .update(caseSummariesTable)
      .set({ content, updatedAt: new Date() })
      .where(eq(caseSummariesTable.caseId, caseId))
      .returning();
  } else {
    [summary] = await db
      .insert(caseSummariesTable)
      .values({ caseId, content })
      .returning();
  }
  res.json(summary);
});

export default router;
