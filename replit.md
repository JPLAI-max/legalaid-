# CaseBinder AI

## Overview

CaseBinder AI is a legal evidence organization tool. It helps users upload case evidence, search documents, create a chronological legal timeline, type their case narrative, generate a neutral AI-powered case summary, attach evidence to timeline events, and export an attorney-ready packet.

**Disclaimer:** CaseBinder AI is an organization tool and does not provide legal advice.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/casebinder-ai)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Clerk (Replit-managed)
- **File storage**: Replit Object Storage (GCS-backed)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.1 for summary/event suggestion)
- **Validation**: Zod, drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Architecture

```
artifacts/
  casebinder-ai/     # React + Vite frontend (previewPath: /)
  api-server/        # Express API server (previewPath: /api)

lib/
  api-spec/          # OpenAPI spec + codegen config
  api-client-react/  # Generated React Query hooks
  api-zod/           # Generated Zod schemas
  db/                # PostgreSQL + Drizzle ORM schema
  object-storage-web/ # Client-side file upload utilities (Uppy)
  integrations-openai-ai-server/ # OpenAI server SDK wrapper
```

## Database Tables

- `cases` — user case records
- `evidence` — uploaded evidence files metadata
- `timeline_events` — chronological case events
- `event_evidence` — join table linking events to evidence
- `transcripts` — case narratives (typed or microphone)
- `suggested_events` — AI-suggested timeline events from transcripts
- `case_summaries` — AI-generated / user-edited case summaries
- `exports` — export job records (pdf/zip)
- `email_connections` — OAuth tokens for Gmail / Outlook accounts per user
- `email_metadata` — full metadata for imported emails (linked to evidence)

## Features

- Case management (create, edit, list cases)
- Evidence upload (file upload via object storage, OCR, tagging, people)
- Evidence search (full-text, filters)
- Timeline builder (manual + AI-suggested events, evidence linking)
- Speak Your Case (microphone + voice dictation for all text fields)
- AI Case Summary (OpenAI-powered neutral summary + narrative)
- Export (PDF + ZIP attorney-ready packet)
- Email Import (Gmail + Outlook OAuth, search filters, selective import as evidence)

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR` — Object storage
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI via Replit AI Integrations
- `SESSION_SECRET` — Session secret
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Gmail OAuth (optional, for Email Import)
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` — Outlook OAuth (optional, for Email Import)

## Email Import OAuth Setup

To enable Email Import, register OAuth apps and set the above secrets:
- Gmail: Google Cloud Console → APIs & Services → OAuth 2.0 → redirect URI `https://YOUR_DOMAIN/api/email/oauth/callback/gmail`
- Outlook: Azure Portal → App Registrations → redirect URI `https://YOUR_DOMAIN/api/email/oauth/callback/outlook`

The feature gracefully shows a setup guide in-app if credentials are missing.
