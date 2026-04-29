import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { casesTable } from "./cases";
import { evidenceTable } from "./evidence";

export const timelineEventsTable = pgTable("timeline_events", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id")
    .notNull()
    .references(() => casesTable.id, { onDelete: "cascade" }),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time"),
  title: text("title").notNull(),
  description: text("description"),
  attorneyNote: text("attorney_note"),
  people: text("people").array().default([]).notNull(),
  tags: text("tags").array().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const eventEvidenceTable = pgTable("event_evidence", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => timelineEventsTable.id, { onDelete: "cascade" }),
  evidenceId: integer("evidence_id")
    .notNull()
    .references(() => evidenceTable.id, { onDelete: "cascade" }),
  attachedAt: timestamp("attached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertTimelineEventSchema = createInsertSchema(
  timelineEventsTable,
).omit({ id: true, createdAt: true });

export type InsertTimelineEvent = z.infer<typeof insertTimelineEventSchema>;
export type TimelineEvent = typeof timelineEventsTable.$inferSelect;
export type EventEvidence = typeof eventEvidenceTable.$inferSelect;
