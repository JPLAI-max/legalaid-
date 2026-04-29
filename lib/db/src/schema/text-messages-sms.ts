import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { textMessageThreadsTable } from "./text-message-threads";

export const smsMessagesTable = pgTable("sms_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id")
    .notNull()
    .references(() => textMessageThreadsTable.id, { onDelete: "cascade" }),
  sender: text("sender").notNull(),
  senderIsMe: boolean("sender_is_me").default(false).notNull(),
  content: text("content").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sequenceNumber: integer("sequence_number").default(0).notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertSmsMessageSchema = createInsertSchema(
  smsMessagesTable
).omit({ id: true, importedAt: true });

export type SmsMessage = typeof smsMessagesTable.$inferSelect;
export type InsertSmsMessage = z.infer<typeof insertSmsMessageSchema>;
