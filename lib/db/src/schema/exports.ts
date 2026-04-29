import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { casesTable } from "./cases";

export const exportTypeEnum = pgEnum("export_type", ["pdf", "zip"]);

export const exportStatusEnum = pgEnum("export_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const exportsTable = pgTable("exports", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id")
    .notNull()
    .references(() => casesTable.id, { onDelete: "cascade" }),
  exportType: exportTypeEnum("export_type").notNull(),
  status: exportStatusEnum("status").default("pending").notNull(),
  objectPath: text("object_path"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Export = typeof exportsTable.$inferSelect;
