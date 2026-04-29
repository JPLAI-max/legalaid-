import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { casesTable } from "./cases";

export const processingStatusEnum = pgEnum("processing_status", [
  "pending",
  "processing",
  "processed",
  "failed",
]);

export const evidenceTable = pgTable("evidence", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id")
    .notNull()
    .references(() => casesTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(),
  objectPath: text("object_path").notNull(),
  fileSize: integer("file_size"),
  detectedDate: text("detected_date"),
  processingStatus: processingStatusEnum("processing_status")
    .default("pending")
    .notNull(),
  textPreview: text("text_preview"),
  tags: text("tags").array().default([]).notNull(),
  people: text("people").array().default([]).notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertEvidenceSchema = createInsertSchema(evidenceTable).omit({
  id: true,
  uploadedAt: true,
});

export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type Evidence = typeof evidenceTable.$inferSelect;
