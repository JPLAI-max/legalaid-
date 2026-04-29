import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { evidenceTable } from "./evidence";

export const emailMetadataTable = pgTable("email_metadata", {
  id: serial("id").primaryKey(),
  evidenceId: integer("evidence_id")
    .notNull()
    .references(() => evidenceTable.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  externalId: varchar("external_id", { length: 500 }),
  sender: text("sender"),
  recipients: text("recipients"),
  subject: text("subject"),
  bodyText: text("body_text"),
  snippet: text("snippet"),
  hasAttachment: boolean("has_attachment").default(false).notNull(),
  attachmentMetadata: text("attachment_metadata"),
  emailDate: timestamp("email_date", { withTimezone: true }),
  importedAt: timestamp("imported_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type EmailMetadata = typeof emailMetadataTable.$inferSelect;
