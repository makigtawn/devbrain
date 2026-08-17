# devbrain

> Never solve the same problem twice.

Your personal, searchable, AI-powered memory of everything you've ever coded, debugged, or learned.

## Structure

- `web/` - Next.js 16 app (dashboard, auth, API, tRPC routers)
- `extension/` - Plasmo browser extension (save from anywhere)
- `docker-compose.yml` - local Postgres + pgvector, for dev without Supabase

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · tRPC · Prisma 7
(driver adapter) · Supabase (Postgres + Auth) · pgvector · Gemini (embeddings +
auto-tagging) · Plasmo (browser extension)

## Setup

### 1. Database + Auth (Supabase)

1. Create a project at supabase.com.
2. Run [`web/prisma/sql/01_extensions.sql`](web/prisma/sql/01_extensions.sql)
   (the `vector` and `pg_trgm` extensions). These must exist before Prisma can
   create the `embedding vector(1536)` column.
3. Copy the project URL, anon key, and a Postgres connection string
   (Settings → Database → Connection string).

   Alternatively, for fully local dev without a Supabase project:
   `docker compose up -d` starts Postgres with pgvector pre-enabled at
   `postgresql://postgres:password@localhost:5432/devbrain` - but you'll
   still need a Supabase project for Auth, since the app uses Supabase Auth
   for sessions.

### 2. Web app

Create `web/.env`:

```bash
# Required — the app will not build or boot without these.
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<region>.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key>

# Optional — each degrades gracefully when unset, loudly in production.
GEMINI_API_KEY=            # unset: heuristic tagging, semantic search off
UPSTASH_REDIS_REST_URL=    # unset (either var): rate limiting off, fail-open
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # canonical origin, no trailing slash
```

Then:

```bash
cd web
npm install            # postinstall runs `prisma generate`
npx prisma db push     # creates tables from prisma/schema.prisma
npm run dev
```

Then run [`web/prisma/sql/02_indexes.sql`](web/prisma/sql/02_indexes.sql) to add
the HNSW vector index and the composite list index — Prisma's schema language
can't declare those, so they don't come from `db push`.

`web/.env` is loaded automatically by both Next.js and Prisma (no `.env` layer).
Required vars are validated at build and boot by `web/src/env.ts`; a missing or
malformed one fails the build with a readable message instead of the first
request with a driver stack trace.

> This project uses `prisma db push` plus the SQL in `prisma/sql/`, **not** a
> Prisma migration history. There is no `prisma/migrations` directory and
> `prisma migrate dev` / `migrate deploy` will not work.

Visit http://localhost:3000, sign up, and start saving entries.

### 3. Browser extension (optional)

```bash
cd extension
cp .env.example .env.local   # PLASMO_PUBLIC_SUPABASE_URL/ANON_KEY from web/.env,
                             # API_BASE_URL = where the web app is running
npm install
npm run dev
```

Then in Chrome: `chrome://extensions` → enable Developer Mode → "Load
unpacked" → select `extension/build/chrome-mv3-dev`. Sign in with your
devbrain account and use the popup, or right-click selected text on any page
→ "Save to devbrain".

## What's implemented (Phase 1 MVP)

- Email/password auth (Supabase Auth), session refresh via `proxy.ts`
- Entry CRUD: snippet / note / error / link / doc, with a syntax-highlighted
  viewer (Shiki) for code/error entries
- AI auto-tagging + type classification on save (Gemini 3.5 Flash Lite), with
  a heuristic fallback when `GEMINI_API_KEY` is unset
- Hybrid search: keyword (Postgres `ILIKE`) + semantic (pgvector cosine
  similarity on `gemini-embedding-001`), merged and ranked
- Tags (auto-generated, browsable) and Collections (manual folders)
- Browser extension: popup quick-save + right-click "save selection"

- Per-user rate limiting (Upstash Redis) on entry writes and search — the two
  paths that spend Gemini quota. Fails open when Upstash isn't configured.

## Not yet implemented

- Team workspaces / roles (schema exists, no UI)
- Public "Brain" profiles, marketplace, Slack/Discord bot (Phase 3)
- Billing (Plan field exists on User; no Stripe integration)
- Content-Security-Policy header (needs per-request nonces via `proxy.ts`;
  the other security headers are set in `web/next.config.ts`)

## Deployment

Target is Vercel + Supabase, but nothing below is Vercel-specific except the
project settings.

### 1. Provision

| Service | What for | Notes |
| --- | --- | --- |
| Supabase | Postgres + Auth | Enable `vector` and `pg_trgm` via `prisma/sql/01_extensions.sql` |
| Gemini API key | Auto-tagging, embeddings | Optional — without it, tagging falls back to heuristics and search degrades to keyword-only |
| Upstash Redis | Rate limiting | Optional but **strongly recommended** — without it rate limiting is disabled and fails open |

### 2. Database

Three steps, from your own machine — schema setup is not part of the Vercel
build. The order is not optional: the extensions must exist before Prisma can
create the `embedding vector(1536)` column, and the indexes need tables to exist.

```bash
cd web
npx prisma db execute --file prisma/sql/01_extensions.sql   # vector, pg_trgm
npx prisma db push                                          # tables, columns, enums
npx prisma db execute --file prisma/sql/02_indexes.sql      # HNSW + composite indexes
```

`prisma db execute` reads `DATABASE_URL` from `web/.env` via `prisma.config.ts`.
`psql "$DATABASE_URL" -f <file>` or pasting into the Supabase SQL editor does the
same job — use whichever you prefer.

Both SQL files are idempotent, so re-running either is safe. Point
`DATABASE_URL` at the **direct connection or session pooler** for these three
commands, not the transaction pooler (6543) — `CREATE EXTENSION` and
`CREATE INDEX` can't run inside a pooled transaction.

### 3. Web app

Import the repo on Vercel and set **Root Directory** to `web`. Build and install
commands need no overrides: `postinstall` runs `prisma generate`, and `build`
runs it again before `next build` (the generated client is gitignored, so a
fresh checkout has no `@/generated/prisma` without it).

Set the same environment variables listed under [Setup → Web app](#2-web-app),
with two production-specific differences:

- `DATABASE_URL` must use Supabase's **transaction-mode pooler (port 6543)**.
  The direct connection runs out of Postgres connections under serverless
  fan-out. `web/src/server/db.ts` sizes its pool assuming the pooler.
- `NEXT_PUBLIC_SITE_URL` must be your real origin, no trailing slash. It backs
  OG/metadata URLs and password-reset links.

Then in Supabase → Authentication → URL Configuration, set the Site URL to the
same origin and add `https://your-domain.com/auth/callback` to the redirect
allowlist, or email confirmation and password reset will bounce.

### 4. Verify

```bash
curl https://your-domain.com/api/health
# {"status":"ok","database":"ok","latencyMs":12}
```

`/api/health` checks database reachability, is unauthenticated, and is excluded
from the auth proxy. Point your uptime monitor at it. It returns 503 with
`{"status":"error","database":"unreachable"}` when Postgres is unreachable.

Check the deploy logs for `[env]` warnings — those flag config that is valid but
probably wrong for production (missing Gemini key, missing Upstash, a
`localhost` or non-pooler `DATABASE_URL`).

### 5. Browser extension

```bash
cd extension
cp .env.production.example .env.production   # API_BASE_URL = your deployed origin
npm ci && npm run build && npm run package
```

Produces `extension/build/chrome-mv3-prod.zip` for the Chrome Web Store. The
`Submit extension to Web Store` GitHub Action does the same thing and uploads it
— it needs the `PLASMO_PUBLIC_*` repository *variables* and a `SUBMIT_KEYS`
secret ([BPP keys](https://github.com/PlasmoHQ/bpp)).

`PLASMO_PUBLIC_*` values are inlined into the shipped bundle, so only ever put
public values there. The Supabase anon key is public by design; the
`service_role` key must never appear in an extension env file.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs lint, typecheck, and
build for `web/`, and a build for `extension/`, on every push to `main` and
every PR.

```bash
cd web && npm run lint && npm run typecheck && npm run build
```
