-- Fix 5: adds embedding_status tracking to entries.
-- Run in the Supabase SQL editor, or apply the equivalent schema change
-- (already made in prisma/schema.prisma) via `npx prisma db push`.

DO $$ BEGIN
  CREATE TYPE "EmbeddingStatus" AS ENUM ('pending', 'success', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "entries"
  ADD COLUMN IF NOT EXISTS "embedding_status" "EmbeddingStatus" NOT NULL DEFAULT 'pending';

-- Backfill: entries that already have an embedding are already searchable, so mark
-- them 'success' instead of leaving every pre-existing row stuck on 'pending'.
UPDATE "entries" SET "embedding_status" = 'success' WHERE "embedding" IS NOT NULL;
