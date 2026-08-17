-- Fix 6: HNSW index for pgvector semantic search.
-- Run in the Supabase SQL editor (Database → SQL Editor).
--
-- m / ef_construction explained in the chat response — short version: m=16 controls
-- how many graph connections each vector gets (higher = better recall, more memory/build
-- time), ef_construction=64 controls how thorough the build-time search is (higher = better
-- graph quality, slower to build). Both are pgvector's own defaults and a sane starting
-- point below ~1M rows.

CREATE INDEX IF NOT EXISTS entries_embedding_hnsw_idx
  ON "entries"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;
