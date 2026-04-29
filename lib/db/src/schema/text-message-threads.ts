import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { casesTable } from "./cases";
import { evidenceTable } from "./evidence";

export const textMessageThreadsTable = pgTable("text_message_threads", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id")
    .notNull()
    .references(() => casesTable.id, { onDelete: "cascade" }),
  evidenceId: integer("evidence_id").references(() => evidenceTable.id, {
    onDelete: "set null",
  }),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone"),
  sourceFilename: text("source_filename").notNull(),
  messageCount: integer("message_count").default(0).notNull(),
  firstMessageAt: timestamp("first_message_at", { withTimezone: true }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertTextMessageThreadSchema = createInsertSchema(
  textMessageThreadsTable
).omit({ id: true, createdAt: true });

export type TextMessageThread = typeof textMessageThreadsTable.$inferSelect;
export type InsertTextMessageThread = z.infer<
  typeof insertTextMessageThreadSchema
>;
