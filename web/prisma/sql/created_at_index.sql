-- Fix 11: composite index covering entries.list's filter (user_id) + sort (created_at DESC)
-- in a single index scan. Run in the Supabase SQL editor.
--
-- schema.prisma's Entry model already declares the equivalent index
-- (@@index([userId, createdAt(sort: Desc)])) so a future `npx prisma db push` will keep
-- recognizing this index as expected schema, not drift.

CREATE INDEX IF NOT EXISTS entries_user_id_created_at_idx
  ON "entries" (user_id, created_at DESC);
