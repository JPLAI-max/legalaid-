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

export const transcriptSourceEnum = pgEnum("transcript_source", [
  "typed",
  "microphone",
]);

export const confidenceLevelEnum = pgEnum("confidence_level", [
  "low",
  "medium",
  "high",
]);

export const suggestedEventStatusEnum = pgEnum("suggested_event_status", [
  "pending",
  "accepted",
  "ignored",
]);

export const transcriptsTable = pgTable("transcripts", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id")
    .notNull()
    .references(() => casesTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  source: transcriptSourceEnum("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const suggestedEventsTable = pgTable("suggested_events", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id")
    .notNull()
    .references(() => casesTable.id, { onDelete: "cascade" }),
  estimatedDate: text("estimated_date"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  people: text("people").array().default([]).notNull(),
  confidenceLevel: confidenceLevelEnum("confidence_level")
    .default("medium")
    .notNull(),
  suggestedSearchTerms: text("suggested_search_terms")
    .array()
    .default([])
    .notNull(),
  status: suggestedEventStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const caseSummariesTable = pgTable("case_summaries", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id")
    .notNull()
    .references(() => casesTable.id, { onDelete: "cascade" })
    .unique(),
  content: text("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertTranscriptSchema = createInsertSchema(transcriptsTable).omit(
  { id: true, createdAt: true, updatedAt: true },
);

export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;
export type Transcript = typeof transcriptsTable.$inferSelect;
export type SuggestedEvent = typeof suggestedEventsTable.$inferSelect;
export type CaseSummary = typeof caseSummariesTable.$inferSelect;
