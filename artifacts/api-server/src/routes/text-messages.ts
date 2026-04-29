import { Router } from "express";
import multer from "multer";
import {
  db,
  textMessageThreadsTable,
  smsMessagesTable,
  evidenceTable,
  casesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@clerk/express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ObjectStorageService } from "../lib/objectStorage";

const objectStorageService = new ObjectStorageService();

const router = Router();

// ─── Multer (memory storage, max 25 MB) ──────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "text/plain",
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(txt|pdf|jpg|jpeg|png|webp)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Please upload TXT, PDF, JPG, or PNG."));
    }
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function verifyCase(userId: string, caseId: number): Promise<boolean> {
  const [found] = await db
    .select({ id: casesTable.id })
    .from(casesTable)
    .where(and(eq(casesTable.id, caseId), eq(casesTable.userId, userId)));
  return !!found;
}

interface ParsedMessage {
  sender: string;
  senderIsMe: boolean;
  content: string;
  timestamp: string | null;
  sequenceNumber: number;
}

interface ParsedConversation {
  contactName: string;
  contactPhone: string | null;
  messages: ParsedMessage[];
}

// ─── PDF text extraction (simple, no native deps) ────────────────────────────

function extractTextFromPdfBuffer(buffer: Buffer): string {
  // Simple regex-based text extraction from PDF binary
  // Works for digitally-created PDFs; not for scanned images
  const content = buffer.toString("latin1");
  const textBlocks: string[] = [];

  // Extract text from BT...ET blocks (PDF text operators)
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(content)) !== null) {
    const block = match[1];
    // Extract string literals from (text) Tj / [(text)] TJ operators
    const strRegex = /\(([^)\\]*(\\.[^)\\]*)*)\)\s*(?:Tj|TJ)/g;
    let strMatch;
    while ((strMatch = strRegex.exec(block)) !== null) {
      const raw = strMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\t/g, " ")
        .replace(/\\\\/g, "\\")
        .replace(/\\[()]/g, (m) => m[1]);
      if (raw.trim()) textBlocks.push(raw);
    }
    // Also extract hex strings <hex> Tj
    const hexRegex = /<([0-9a-fA-F]+)>\s*(?:Tj|TJ)/g;
    let hexMatch;
    while ((hexMatch = hexRegex.exec(block)) !== null) {
      const hex = hexMatch[1];
      const decoded = Buffer.from(hex, "hex").toString("utf-8");
      if (decoded.trim()) textBlocks.push(decoded);
    }
  }

  return textBlocks.join(" ").replace(/\s+/g, " ").trim();
}

// ─── OpenAI parsing ───────────────────────────────────────────────────────────

async function parseTextContent(
  rawText: string,
  filename: string,
  myName: string
): Promise<ParsedConversation> {
  const system = `You are a legal evidence assistant parsing text message conversation exports.
Extract all messages into structured JSON. Be careful to correctly identify who sent each message.
"Me" or "${myName}" refers to the person who exported these messages (the user).
Return ONLY valid JSON with no markdown, no explanation.`;

  const prompt = `Parse this text message conversation export into structured JSON.

Source filename: ${filename}
User's name/number: ${myName || "unknown"}

Raw content:
"""
${rawText.slice(0, 12000)}
"""

Return a JSON object exactly like this:
{
  "contactName": "the other person's name or phone number",
  "contactPhone": "their phone number if visible, else null",
  "messages": [
    {
      "sender": "exact name or number",
      "senderIsMe": true or false,
      "content": "message text",
      "timestamp": "ISO 8601 datetime string if available, else null",
      "sequenceNumber": 1
    }
  ]
}

Rules:
- senderIsMe should be true if sender appears to be the user (Me, ${myName || "I"}, messages on the right side in screenshots, or outgoing)
- Include ALL messages in order
- sequenceNumber starts at 1 and increases
- If timestamps are ambiguous or missing, use null`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4096,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as ParsedConversation;
  return parsed;
}

async function parseImageContent(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  myName: string
): Promise<ParsedConversation> {
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const system = `You are a legal evidence assistant parsing text message screenshot images.
Extract all visible messages into structured JSON.
"Me" or "${myName}" refers to the person whose screenshot this is.
Return ONLY valid JSON with no markdown, no explanation.`;

  const prompt = `Parse this text message screenshot into structured JSON.
User's name/number: ${myName || "the phone owner"}

Return a JSON object exactly like this:
{
  "contactName": "the other person's name or phone number (infer from context)",
  "contactPhone": "their phone number if visible, else null",
  "messages": [
    {
      "sender": "name or number",
      "senderIsMe": true or false,
      "content": "exact message text",
      "timestamp": "ISO 8601 datetime if visible, else null",
      "sequenceNumber": 1
    }
  ]
}

Rules:
- Messages on the RIGHT side of the screen are typically from "me" (senderIsMe: true)
- Messages on the LEFT side are from the contact (senderIsMe: false)
- Read all text bubbles in order from top to bottom
- Include delivery status, reactions if relevant as part of content
- sequenceNumber starts at 1`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4096,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as ParsedConversation;
  return parsed;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Upload + parse
router.post(
  "/cases/:caseId/text-messages/upload",
  requireAuth(),
  upload.single("file"),
  async (req, res) => {
    const userId = req.auth.userId!;
    const caseId = Number(req.params.caseId);
    if (!(await verifyCase(userId, caseId)))
      return res.status(404).json({ error: "Case not found" });

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const file = req.file;
    const myName = (req.body.myName as string) || "Me";
    const mime = file.mimetype;
    const filename = file.originalname;

    let parsed: ParsedConversation;

    try {
      const isImage = mime.startsWith("image/");
      const isPdf = mime === "application/pdf" || filename.match(/\.pdf$/i);

      if (isImage) {
        parsed = await parseImageContent(file.buffer, mime, filename, myName);
      } else if (isPdf) {
        // Extract text from PDF buffer
        let pdfText = extractTextFromPdfBuffer(file.buffer);
        if (!pdfText || pdfText.length < 50) {
          // PDF text extraction failed (scanned PDF)
          return res.status(422).json({
            error:
              "This PDF appears to be a scanned image. Please take screenshots of the messages and upload them as JPG or PNG files instead.",
          });
        }
        parsed = await parseTextContent(pdfText, filename, myName);
      } else {
        // TXT or fallback
        const text = file.buffer.toString("utf-8");
        parsed = await parseTextContent(text, filename, myName);
      }
    } catch (err) {
      req.log.error({ err }, "Failed to parse text message file");
      return res.status(500).json({ error: "Failed to parse the file. Please check the format and try again." });
    }

    if (!parsed.messages || parsed.messages.length === 0) {
      return res.status(422).json({
        error: "No messages could be found in the file. Please verify the file contains text message content.",
      });
    }

    // Store original file in object storage
    let objectPath = `sms:local:${filename}`;
    try {
      objectPath = await objectStorageService.uploadBuffer(file.buffer, mime);
    } catch {
      req.log.warn("Could not save original file to object storage, continuing");
    }

    // Create evidence record
    const contactName = parsed.contactName || "Unknown Contact";
    const [evidence] = await db
      .insert(evidenceTable)
      .values({
        caseId,
        filename: `SMS: ${contactName} (${filename})`,
        fileType: "text/sms",
        objectPath,
        processingStatus: "processed",
        textPreview: parsed.messages.slice(0, 3).map((m) => `${m.sender}: ${m.content}`).join(" | "),
        tags: ["text message", "sms", contactName.toLowerCase()],
        people: [contactName],
      })
      .returning();

    // Compute date range
    const timestamps = parsed.messages
      .map((m) => m.timestamp)
      .filter(Boolean)
      .map((t) => new Date(t!))
      .filter((d) => !isNaN(d.getTime()));

    const firstAt = timestamps.length > 0 ? timestamps[0] : null;
    const lastAt = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;

    // Create thread record
    const [thread] = await db
      .insert(textMessageThreadsTable)
      .values({
        caseId,
        evidenceId: evidence.id,
        contactName,
        contactPhone: parsed.contactPhone ?? null,
        sourceFilename: filename,
        messageCount: parsed.messages.length,
        firstMessageAt: firstAt,
        lastMessageAt: lastAt,
      })
      .returning();

    // Insert all messages
    if (parsed.messages.length > 0) {
      await db.insert(smsMessagesTable).values(
        parsed.messages.map((m, i) => ({
          threadId: thread.id,
          sender: m.sender || (m.senderIsMe ? myName : contactName),
          senderIsMe: !!m.senderIsMe,
          content: m.content,
          sentAt: m.timestamp ? new Date(m.timestamp) : null,
          sequenceNumber: m.sequenceNumber ?? i + 1,
        }))
      );
    }

    const messages = await db
      .select()
      .from(smsMessagesTable)
      .where(eq(smsMessagesTable.threadId, thread.id))
      .orderBy(smsMessagesTable.sequenceNumber);

    return res.status(201).json({ thread, messages, evidenceId: evidence.id });
  }
);

// List threads
router.get("/cases/:caseId/text-messages/threads", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId)))
    return res.status(404).json({ error: "Case not found" });

  const threads = await db
    .select()
    .from(textMessageThreadsTable)
    .where(eq(textMessageThreadsTable.caseId, caseId))
    .orderBy(textMessageThreadsTable.createdAt);

  return res.json(threads);
});

// Get thread with messages
router.get("/cases/:caseId/text-messages/threads/:threadId", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId)))
    return res.status(404).json({ error: "Case not found" });

  const threadId = Number(req.params.threadId);
  const [thread] = await db
    .select()
    .from(textMessageThreadsTable)
    .where(
      and(
        eq(textMessageThreadsTable.id, threadId),
        eq(textMessageThreadsTable.caseId, caseId)
      )
    );

  if (!thread) return res.status(404).json({ error: "Thread not found" });

  const messages = await db
    .select()
    .from(smsMessagesTable)
    .where(eq(smsMessagesTable.threadId, threadId))
    .orderBy(smsMessagesTable.sequenceNumber);

  return res.json({ thread, messages });
});

// Delete thread
router.delete("/cases/:caseId/text-messages/threads/:threadId", requireAuth(), async (req, res) => {
  const userId = req.auth.userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId)))
    return res.status(404).json({ error: "Case not found" });

  const threadId = Number(req.params.threadId);
  await db
    .delete(textMessageThreadsTable)
    .where(
      and(
        eq(textMessageThreadsTable.id, threadId),
        eq(textMessageThreadsTable.caseId, caseId)
      )
    );

  return res.status(204).send();
});

// Suggest timeline events from a thread
router.post(
  "/cases/:caseId/text-messages/threads/:threadId/suggest",
  requireAuth(),
  async (req, res) => {
    const userId = req.auth.userId!;
    const caseId = Number(req.params.caseId);
    if (!(await verifyCase(userId, caseId)))
      return res.status(404).json({ error: "Case not found" });

    const threadId = Number(req.params.threadId);
    const [thread] = await db
      .select()
      .from(textMessageThreadsTable)
      .where(
        and(
          eq(textMessageThreadsTable.id, threadId),
          eq(textMessageThreadsTable.caseId, caseId)
        )
      );

    if (!thread) return res.status(404).json({ error: "Thread not found" });

    const messages = await db
      .select()
      .from(smsMessagesTable)
      .where(eq(smsMessagesTable.threadId, threadId))
      .orderBy(smsMessagesTable.sequenceNumber);

    const conversationText = messages
      .map(
        (m) =>
          `[${m.sequenceNumber}] ${m.sentAt ? new Date(m.sentAt).toLocaleString() : "unknown time"} ${m.senderIsMe ? "Me" : m.sender}: ${m.content}`
      )
      .join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a neutral legal document assistant analyzing text message conversations to identify key legal events.
Detect events like: missed obligations, agreements, threats, admissions, denials, payments referenced, deadlines mentioned, and significant exchanges.
Return ONLY valid JSON.`,
        },
        {
          role: "user",
          content: `Analyze this text message conversation between "${thread.contactName}" and the user. Identify key legal events.

${conversationText}

Return a JSON array of suggested timeline events:
[
  {
    "title": "short event title",
    "estimatedDate": "YYYY-MM-DD if determinable, else null",
    "description": "2-3 sentence neutral description of what happened",
    "people": ["name1", "name2"],
    "confidenceLevel": "high|medium|low",
    "relevantMessageIds": [array of sequenceNumbers from the conversation]
  }
]

Focus on legally significant events only. Return an empty array [] if no key events found.`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw);
    const events = Array.isArray(data) ? data : (data.events ?? data.suggestions ?? []);
    return res.json(events);
  }
);

export default router;
