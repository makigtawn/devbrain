-- devbrain — step 1 of 2. Run this BEFORE `npx prisma db push`.
--
-- Prisma cannot create these itself, and `vector` must already exist before the push can
-- create the `embedding vector(1536)` column on `entries`.
--
-- Run with any ONE of:
--   npx prisma db execute --file prisma/sql/01_extensions.sql   (uses DATABASE_URL from .env)
--   psql "$DATABASE_URL" -f prisma/sql/01_extensions.sql
--   Supabase → SQL Editor → paste
--
-- Idempotent: safe to re-run at any point.
--
-- Not valid over Supabase's TRANSACTION pooler (port 6543) — use the direct connection or
-- the session pooler. CREATE EXTENSION cannot run inside a pooled transaction.

-- pgvector: backs the `embedding vector(1536)` column and cosine-similarity search.
CREATE EXTENSION IF NOT EXISTS vector;

-- pg_trgm: trigram matching for keyword search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
