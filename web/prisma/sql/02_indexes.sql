-- devbrain — step 2 of 2. Run this AFTER `npx prisma db push`.
--
-- Everything here needs the `entries` table to already exist, which is why it is a separate
-- file from 01_extensions.sql. Running it too early fails with
-- `relation "entries" does not exist` — `IF NOT EXISTS` guards the column or index, never
-- the table underneath it.
--
-- Run with any ONE of:
--   npx prisma db execute --file prisma/sql/02_indexes.sql   (uses DATABASE_URL from .env)
--   psql "$DATABASE_URL" -f prisma/sql/02_indexes.sql
--   Supabase → SQL Editor → paste
--
-- Idempotent: safe to re-run after any later `db push`.
--
-- Not valid over Supabase's TRANSACTION pooler (port 6543) — use the direct connection or
-- the session pooler.
--
-- The single-fix files alongside this one (embedding_status_column.sql, hnsw_index.sql,
-- created_at_index.sql) are the historical versions; this file is their union. On a fresh
-- database you only need 01_extensions.sql and this one.


-- ── Columns an older database may predate ─────────────────────────────────────

-- No-ops on a fresh database: `db push` has already created both the enum type and the
-- column. This only does work on a database created before embedding_status existed.
DO $$ BEGIN
  CREATE TYPE "EmbeddingStatus" AS ENUM ('pending', 'success', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "entries"
  ADD COLUMN IF NOT EXISTS "embedding_status" "EmbeddingStatus" NOT NULL DEFAULT 'pending';

-- Backfill: rows that already have an embedding are already searchable, so mark them
-- 'success' rather than leaving every pre-existing row stuck on 'pending'.
UPDATE "entries" SET "embedding_status" = 'success' WHERE "embedding" IS NOT NULL;


-- ── Indexes Prisma's schema language cannot declare ───────────────────────────

-- HNSW index for pgvector semantic search. m=16 sets how many graph connections each vector
-- gets (higher = better recall, more memory and build time); ef_construction=64 sets how
-- thorough the build-time search is (higher = better graph, slower build). Both are
-- pgvector's own defaults and a sane starting point below ~1M rows.
--
-- Partial on `embedding IS NOT NULL` so entries still awaiting an embedding cost nothing.
CREATE INDEX IF NOT EXISTS entries_embedding_hnsw_idx
  ON "entries"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

-- Composite index covering entries.list's filter (user_id) + sort (created_at DESC) in a
-- single index scan. schema.prisma declares the equivalent index, so a later `db push`
-- recognizes this as expected schema rather than drift.
CREATE INDEX IF NOT EXISTS entries_user_id_created_at_idx
  ON "entries" (user_id, created_at DESC);
