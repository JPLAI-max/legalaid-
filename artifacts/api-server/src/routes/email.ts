import { Router } from "express";
import {
  db,
  emailConnectionsTable,
  emailMetadataTable,
  evidenceTable,
  casesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireApiAuth } from "../middlewares/requireApiAuth";
import { getAuth } from "@clerk/express";
import { z } from "zod";

const router = Router({ mergeParams: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAppDomain(): string {
  const domains = process.env.REPLIT_DOMAINS;
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  return domains?.split(",")[0] || devDomain || "localhost";
}

function getCallbackUrl(provider: string): string {
  return `https://${getAppDomain()}/api/email/oauth/callback/${provider}`;
}

async function verifyCase(userId: string, caseId: number): Promise<boolean> {
  const [found] = await db
    .select({ id: casesTable.id })
    .from(casesTable)
    .where(and(eq(casesTable.id, caseId), eq(casesTable.userId, userId)));
  return !!found;
}

function getHeader(
  headers: Array<{ name: string; value: string }>,
  name: string
): string {
  return (
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

// ─── Token refresh ────────────────────────────────────────────────────────────

async function getValidGmailToken(connection: typeof emailConnectionsTable.$inferSelect): Promise<string> {
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (connection.accessToken && (!connection.tokenExpiry || connection.tokenExpiry > fiveMinFromNow)) {
    return connection.accessToken;
  }
  if (!connection.refreshToken) throw new Error("No refresh token");
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });
  const data = (await resp.json()) as Record<string, unknown>;
  const token = data.access_token as string;
  const expiry = new Date(Date.now() + ((data.expires_in as number) || 3600) * 1000);
  await db
    .update(emailConnectionsTable)
    .set({ accessToken: token, tokenExpiry: expiry })
    .where(eq(emailConnectionsTable.id, connection.id));
  return token;
}

async function getValidOutlookToken(connection: typeof emailConnectionsTable.$inferSelect): Promise<string> {
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (connection.accessToken && (!connection.tokenExpiry || connection.tokenExpiry > fiveMinFromNow)) {
    return connection.accessToken;
  }
  if (!connection.refreshToken) throw new Error("No refresh token");
  const resp = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access",
    }),
  });
  const data = (await resp.json()) as Record<string, unknown>;
  const token = data.access_token as string;
  const expiry = new Date(Date.now() + ((data.expires_in as number) || 3600) * 1000);
  await db
    .update(emailConnectionsTable)
    .set({ accessToken: token, tokenExpiry: expiry })
    .where(eq(emailConnectionsTable.id, connection.id));
  return token;
}

// ─── Gmail helpers ────────────────────────────────────────────────────────────

function extractGmailBody(payload: Record<string, unknown>): string {
  if (!payload) return "";
  const mimeType = payload.mimeType as string;
  const body = payload.body as Record<string, unknown> | undefined;
  if ((mimeType === "text/plain" || mimeType === "text/html") && body?.data) {
    const text = Buffer.from(body.data as string, "base64url").toString("utf-8");
    if (mimeType === "text/html") {
      return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    return text;
  }
  const parts = payload.parts as Record<string, unknown>[] | undefined;
  if (parts) {
    for (const part of parts) {
      const text = extractGmailBody(part);
      if (text) return text;
    }
  }
  return "";
}

function extractGmailAttachments(payload: Record<string, unknown>): { name: string; mimeType: string; size: number }[] {
  const parts = payload?.parts as Record<string, unknown>[] | undefined;
  if (!parts) return [];
  const attachments: { name: string; mimeType: string; size: number }[] = [];
  for (const part of parts) {
    if (part.filename && (part.filename as string).length > 0) {
      const body = part.body as Record<string, unknown> | undefined;
      attachments.push({
        name: part.filename as string,
        mimeType: (part.mimeType as string) ?? "",
        size: (body?.size as number) ?? 0,
      });
    }
  }
  return attachments;
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const EmailSearchBodySchema = z.object({
  connectionId: z.number().int(),
  from: z.string().nullish(),
  to: z.string().nullish(),
  subject: z.string().nullish(),
  keyword: z.string().nullish(),
  dateFrom: z.string().nullish(),
  dateTo: z.string().nullish(),
  hasAttachment: z.boolean().nullish(),
  folder: z.string().nullish(),
  maxResults: z.number().int().max(50).nullish(),
});

const ImportEmailsBodySchema = z.object({
  connectionId: z.number().int(),
  emailIds: z.array(z.string()),
  tags: z.array(z.string()).optional().default([]),
});

// ─── OAuth: start ─────────────────────────────────────────────────────────────

router.get("/email/oauth/connect/:provider", requireApiAuth(), (req, res) => {
  const provider = req.params.provider;
  const userId = getAuth(req).userId!;
  const returnPath = (req.query.returnPath as string) ?? "/dashboard";
  const state = Buffer.from(JSON.stringify({ userId, returnPath })).toString("base64");

  if (provider === "gmail") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.redirect(`${returnPath}?email_error=setup_required&provider=gmail`);
    }
    const scope = encodeURIComponent(
      "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email"
    );
    const redirect = encodeURIComponent(getCallbackUrl("gmail"));
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${clientId}&redirect_uri=${redirect}` +
      `&response_type=code&scope=${scope}&state=${state}` +
      `&access_type=offline&prompt=consent`;
    return res.redirect(authUrl);
  }

  if (provider === "outlook") {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.redirect(`${returnPath}?email_error=setup_required&provider=outlook`);
    }
    const scope = encodeURIComponent(
      "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access"
    );
    const redirect = encodeURIComponent(getCallbackUrl("outlook"));
    const authUrl =
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
      `?client_id=${clientId}&redirect_uri=${redirect}` +
      `&response_type=code&scope=${scope}&state=${state}`;
    return res.redirect(authUrl);
  }

  return res.status(400).json({ error: "Invalid provider" });
});

// ─── OAuth: callback ─────────────────────────────────────────────────────────

router.get("/email/oauth/callback/:provider", async (req, res) => {
  const provider = req.params.provider;
  const { code, state, error } = req.query as Record<string, string>;

  let returnPath = "/dashboard";
  let userId = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    returnPath = decoded.returnPath ?? "/dashboard";
    userId = decoded.userId ?? "";
  } catch {
    return res.redirect("/dashboard?email_error=invalid_state");
  }

  if (error) return res.redirect(`${returnPath}?email_error=${encodeURIComponent(error)}`);
  if (!code || !userId) return res.redirect(`${returnPath}?email_error=no_code`);

  try {
    if (provider === "gmail") {
      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: getCallbackUrl("gmail"),
          grant_type: "authorization_code",
        }),
      });
      const tokens = (await tokenResp.json()) as Record<string, unknown>;
      if (!tokens.access_token) throw new Error("No token");

      const profileResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = (await profileResp.json()) as Record<string, unknown>;
      const userEmail = (profile.email as string) ?? "unknown@gmail.com";
      const expiry = new Date(Date.now() + ((tokens.expires_in as number) || 3600) * 1000);

      const [existing] = await db
        .select()
        .from(emailConnectionsTable)
        .where(
          and(
            eq(emailConnectionsTable.userId, userId),
            eq(emailConnectionsTable.provider, "gmail"),
            eq(emailConnectionsTable.email, userEmail)
          )
        );

      if (existing) {
        await db
          .update(emailConnectionsTable)
          .set({
            accessToken: tokens.access_token as string,
            refreshToken: (tokens.refresh_token as string | null) ?? existing.refreshToken,
            tokenExpiry: expiry,
          })
          .where(eq(emailConnectionsTable.id, existing.id));
      } else {
        await db.insert(emailConnectionsTable).values({
          userId,
          provider: "gmail",
          email: userEmail,
          accessToken: tokens.access_token as string,
          refreshToken: (tokens.refresh_token as string) ?? null,
          tokenExpiry: expiry,
        });
      }
      return res.redirect(`${returnPath}?email_connected=gmail`);
    }

    if (provider === "outlook") {
      const tokenResp = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          redirect_uri: getCallbackUrl("outlook"),
          grant_type: "authorization_code",
          scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access",
        }),
      });
      const tokens = (await tokenResp.json()) as Record<string, unknown>;
      if (!tokens.access_token) throw new Error("No token");

      const profileResp = await fetch(
        "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      const profile = (await profileResp.json()) as Record<string, unknown>;
      const userEmail =
        (profile.mail as string) || (profile.userPrincipalName as string) || "unknown@outlook.com";
      const expiry = new Date(Date.now() + ((tokens.expires_in as number) || 3600) * 1000);

      const [existing] = await db
        .select()
        .from(emailConnectionsTable)
        .where(
          and(
            eq(emailConnectionsTable.userId, userId),
            eq(emailConnectionsTable.provider, "outlook"),
            eq(emailConnectionsTable.email, userEmail)
          )
        );

      if (existing) {
        await db
          .update(emailConnectionsTable)
          .set({
            accessToken: tokens.access_token as string,
            refreshToken: (tokens.refresh_token as string | null) ?? existing.refreshToken,
            tokenExpiry: expiry,
          })
          .where(eq(emailConnectionsTable.id, existing.id));
      } else {
        await db.insert(emailConnectionsTable).values({
          userId,
          provider: "outlook",
          email: userEmail,
          accessToken: tokens.access_token as string,
          refreshToken: (tokens.refresh_token as string) ?? null,
          tokenExpiry: expiry,
        });
      }
      return res.redirect(`${returnPath}?email_connected=outlook`);
    }
  } catch {
    return res.redirect(`${returnPath}?email_error=token_exchange_failed`);
  }

  return res.status(400).json({ error: "Invalid provider" });
});

// ─── List connections ─────────────────────────────────────────────────────────

router.get("/email/connections", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const connections = await db
    .select({
      id: emailConnectionsTable.id,
      provider: emailConnectionsTable.provider,
      email: emailConnectionsTable.email,
      connectedAt: emailConnectionsTable.connectedAt,
    })
    .from(emailConnectionsTable)
    .where(eq(emailConnectionsTable.userId, userId));
  return res.json(connections);
});

// ─── Delete connection ────────────────────────────────────────────────────────

router.delete("/email/connections/:connectionId", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const connectionId = Number(req.params.connectionId);
  await db
    .delete(emailConnectionsTable)
    .where(
      and(
        eq(emailConnectionsTable.id, connectionId),
        eq(emailConnectionsTable.userId, userId)
      )
    );
  return res.status(204).send();
});

// ─── Search ───────────────────────────────────────────────────────────────────

router.post("/cases/:caseId/emails/search", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const body = EmailSearchBodySchema.parse(req.body);
  const [connection] = await db
    .select()
    .from(emailConnectionsTable)
    .where(
      and(
        eq(emailConnectionsTable.id, body.connectionId),
        eq(emailConnectionsTable.userId, userId)
      )
    );
  if (!connection) return res.status(404).json({ error: "Connection not found" });

  const max = body.maxResults ?? 20;

  if (connection.provider === "gmail") {
    const token = await getValidGmailToken(connection);
    const parts: string[] = [];
    if (body.from) parts.push(`from:${body.from}`);
    if (body.to) parts.push(`to:${body.to}`);
    if (body.subject) parts.push(`subject:${body.subject}`);
    if (body.keyword) parts.push(body.keyword);
    if (body.dateFrom) parts.push(`after:${body.dateFrom.replace(/-/g, "/")}`);
    if (body.dateTo) parts.push(`before:${body.dateTo.replace(/-/g, "/")}`);
    if (body.hasAttachment === true) parts.push("has:attachment");
    if (body.folder) parts.push(`label:${body.folder}`);
    const q = parts.join(" ") || "in:inbox";

    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${max}`;
    const listResp = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!listResp.ok) return res.status(502).json({ error: "Gmail API error" });
    const listData = (await listResp.json()) as { messages?: { id: string }[] };
    if (!listData.messages?.length) return res.json([]);

    const results = await Promise.all(
      listData.messages.map(async (msg) => {
        const detailUrl =
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}` +
          `?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`;
        const dResp = await fetch(detailUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!dResp.ok) return null;
        const d = (await dResp.json()) as Record<string, unknown>;
        const headers = (d.payload as Record<string, unknown>)?.headers as Array<{ name: string; value: string }> ?? [];
        const labelIds = (d.labelIds as string[]) ?? [];
        const payload = d.payload as Record<string, unknown>;
        const parts = payload?.parts as Record<string, unknown>[] | undefined;
        const hasAtt =
          labelIds.includes("HAS_ATTACHMENT") ||
          (parts?.some((p) => p.filename && (p.filename as string).length > 0) ?? false);
        return {
          externalId: msg.id,
          provider: "gmail",
          date: getHeader(headers, "Date") || null,
          from: getHeader(headers, "From") || null,
          to: getHeader(headers, "To") || null,
          subject: getHeader(headers, "Subject") || null,
          snippet: (d.snippet as string) || null,
          hasAttachment: hasAtt,
          labelIds: labelIds.length ? labelIds : null,
        };
      })
    );
    return res.json(results.filter(Boolean));
  }

  if (connection.provider === "outlook") {
    const token = await getValidOutlookToken(connection);
    const filterParts: string[] = [];
    if (body.from) filterParts.push(`from/emailAddress/address eq '${body.from}'`);
    if (body.dateFrom) filterParts.push(`receivedDateTime ge ${body.dateFrom}T00:00:00Z`);
    if (body.dateTo) filterParts.push(`receivedDateTime le ${body.dateTo}T23:59:59Z`);
    if (body.hasAttachment === true) filterParts.push("hasAttachments eq true");

    const select = "$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,hasAttachments";
    let url = `https://graph.microsoft.com/v1.0/me/messages?${select}&$top=${max}`;

    const searchTerm = body.subject || body.keyword;
    if (searchTerm) {
      url += `&$search="${encodeURIComponent(searchTerm)}"`;
    } else if (filterParts.length) {
      url += `&$filter=${encodeURIComponent(filterParts.join(" and "))}`;
    }

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!resp.ok) return res.status(502).json({ error: "Outlook API error" });
    const data = (await resp.json()) as { value?: Record<string, unknown>[] };
    const results = (data.value ?? []).map((msg) => ({
      externalId: msg.id as string,
      provider: "outlook",
      date: (msg.receivedDateTime as string) || null,
      from: (msg.from as Record<string, unknown>)?.emailAddress
        ? ((msg.from as Record<string, unknown>).emailAddress as Record<string, unknown>).address as string
        : null,
      to:
        ((msg.toRecipients as Record<string, unknown>[]) ?? [])
          .map((r) => (r.emailAddress as Record<string, unknown>)?.address as string)
          .filter(Boolean)
          .join(", ") || null,
      subject: (msg.subject as string) || null,
      snippet: (msg.bodyPreview as string) || null,
      hasAttachment: !!(msg.hasAttachments as boolean),
      labelIds: null,
    }));
    return res.json(results);
  }

  return res.status(400).json({ error: "Unsupported provider" });
});

// ─── Import ───────────────────────────────────────────────────────────────────

router.post("/cases/:caseId/emails/import", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const body = ImportEmailsBodySchema.parse(req.body);
  const [connection] = await db
    .select()
    .from(emailConnectionsTable)
    .where(
      and(
        eq(emailConnectionsTable.id, body.connectionId),
        eq(emailConnectionsTable.userId, userId)
      )
    );
  if (!connection) return res.status(404).json({ error: "Connection not found" });

  const imported: (typeof emailMetadataTable.$inferSelect)[] = [];

  for (const emailId of body.emailIds) {
    try {
      let sender = "";
      let recipients = "";
      let subject = "";
      let bodyText = "";
      let snippet = "";
      let hasAttachment = false;
      let attachmentMeta: { name: string; mimeType: string; size: number }[] = [];
      let emailDate: Date | null = null;

      if (connection.provider === "gmail") {
        const token = await getValidGmailToken(connection);
        const resp = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const msg = (await resp.json()) as Record<string, unknown>;
        const payload = msg.payload as Record<string, unknown>;
        const headers = (payload?.headers as Array<{ name: string; value: string }>) ?? [];
        sender = getHeader(headers, "From");
        recipients = getHeader(headers, "To");
        subject = getHeader(headers, "Subject");
        snippet = (msg.snippet as string) ?? "";
        bodyText = extractGmailBody(payload);
        attachmentMeta = extractGmailAttachments(payload);
        hasAttachment =
          attachmentMeta.length > 0 ||
          ((msg.labelIds as string[]) ?? []).includes("HAS_ATTACHMENT");
        const dateStr = getHeader(headers, "Date");
        if (dateStr) {
          try {
            emailDate = new Date(dateStr);
          } catch {
            // ignore invalid date
          }
        }
      }

      if (connection.provider === "outlook") {
        const token = await getValidOutlookToken(connection);
        const resp = await fetch(
          `https://graph.microsoft.com/v1.0/me/messages/${emailId}?$select=id,subject,from,toRecipients,receivedDateTime,body,hasAttachments`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const msg = (await resp.json()) as Record<string, unknown>;
        sender =
          ((msg.from as Record<string, unknown>)?.emailAddress as Record<string, unknown>)?.address as string ?? "";
        recipients = ((msg.toRecipients as Record<string, unknown>[]) ?? [])
          .map((r) => (r.emailAddress as Record<string, unknown>)?.address as string)
          .filter(Boolean)
          .join(", ");
        subject = (msg.subject as string) ?? "";
        const rawBody =
          ((msg.body as Record<string, unknown>)?.content as string) ?? "";
        bodyText = rawBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        snippet = bodyText.substring(0, 200);
        hasAttachment = !!(msg.hasAttachments as boolean);
        if (msg.receivedDateTime) {
          try {
            emailDate = new Date(msg.receivedDateTime as string);
          } catch {
            // ignore
          }
        }
      }

      const [evidence] = await db
        .insert(evidenceTable)
        .values({
          caseId,
          filename: subject || `Email from ${sender}` || "Imported Email",
          fileType: `email/${connection.provider}`,
          objectPath: `email:${connection.provider}:${emailId}`,
          textPreview: snippet || bodyText.substring(0, 500) || null,
          tags: [...(body.tags ?? []), "email", connection.provider],
          people: [
            ...sender.split(",").map((s) => s.trim()).filter(Boolean),
            ...recipients.split(",").map((r) => r.trim()).filter(Boolean),
          ].slice(0, 20),
          detectedDate: emailDate?.toISOString().split("T")[0] ?? null,
          processingStatus: "processed",
        })
        .returning();

      const [meta] = await db
        .insert(emailMetadataTable)
        .values({
          evidenceId: evidence.id,
          provider: connection.provider,
          externalId: emailId,
          sender: sender || null,
          recipients: recipients || null,
          subject: subject || null,
          bodyText: bodyText || null,
          snippet: snippet || null,
          hasAttachment,
          attachmentMetadata:
            attachmentMeta.length > 0 ? JSON.stringify(attachmentMeta) : null,
          emailDate: emailDate ?? null,
        })
        .returning();

      imported.push(meta);
    } catch {
      req.log.warn({ emailId }, "Failed to import email, skipping");
    }
  }

  return res.status(201).json(imported);
});

// ─── List imported emails ─────────────────────────────────────────────────────

router.get("/cases/:caseId/emails", requireApiAuth(), async (req, res) => {
  const userId = getAuth(req).userId!;
  const caseId = Number(req.params.caseId);
  if (!(await verifyCase(userId, caseId))) return res.status(404).json({ error: "Case not found" });

  const emails = await db
    .select({
      id: emailMetadataTable.id,
      evidenceId: emailMetadataTable.evidenceId,
      provider: emailMetadataTable.provider,
      externalId: emailMetadataTable.externalId,
      sender: emailMetadataTable.sender,
      recipients: emailMetadataTable.recipients,
      subject: emailMetadataTable.subject,
      snippet: emailMetadataTable.snippet,
      bodyText: emailMetadataTable.bodyText,
      hasAttachment: emailMetadataTable.hasAttachment,
      attachmentMetadata: emailMetadataTable.attachmentMetadata,
      emailDate: emailMetadataTable.emailDate,
      importedAt: emailMetadataTable.importedAt,
    })
    .from(emailMetadataTable)
    .innerJoin(evidenceTable, eq(emailMetadataTable.evidenceId, evidenceTable.id))
    .where(eq(evidenceTable.caseId, caseId));

  return res.json(emails);
});

export default router;
