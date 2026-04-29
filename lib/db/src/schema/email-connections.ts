import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const emailProviderEnum = pgEnum("email_provider", ["gmail", "outlook"]);

export const emailConnectionsTable = pgTable("email_connections", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  provider: emailProviderEnum("provider").notNull(),
  email: varchar("email", { length: 500 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
  connectedAt: timestamp("connected_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type EmailConnection = typeof emailConnectionsTable.$inferSelect;
