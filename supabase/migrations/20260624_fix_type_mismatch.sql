-- ================================================================
-- CRITICAL FIX: pgvector type mismatch (2026-06-24)
-- Root cause: proposals.quality_tier is stored as TEXT (Drizzle schema)
-- but all match_proposals function versions declare it SMALLINT/SMALLINT
-- in their RETURNS TABLE. PostgreSQL refuses the implicit TEXT→SMALLINT cast.
-- Fix: CAST quality_tier to INTEGER explicitly; use INTEGER in return signature.
-- Safe to run multiple times (CREATE OR REPLACE is idempotent).
-- ================================================================

-- Drop every known overload first to clear ambiguity
DROP FUNCTION IF EXISTS public.match_proposals(vector, text, uuid, int, int);
DROP FUNCTION IF EXISTS public.match_proposals(vector, text, uuid, int);
DROP FUNCTION IF EXISTS public.match_proposals(vector, text, uuid);
DROP FUNCTION IF EXISTS public.match_proposals(vector, text[], uuid, int, int);
DROP FUNCTION IF EXISTS public.match_proposals(vector, text[], uuid, int, int, boolean);
DROP FUNCTION IF EXISTS public.match_proposals(vector(1536), text[], uuid, integer, integer);

-- ----------------------------------------------------------------
-- Canonical match_proposals
-- Parameters align exactly with matchmakingEngine.ts Phase 6 call:
--   supabase.rpc('match_proposals', {
--     query_embedding, match_intents, exclude_user_id,
--     min_quality: 3, result_count: 1000
--   })
--
-- KEY CHANGE: quality_tier returned as INTEGER (not SMALLINT) with
-- an explicit CAST so the function works regardless of whether the
-- live column is TEXT, NUMERIC, or SMALLINT.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_proposals(
  query_embedding  vector(1536),
  match_intents    TEXT[],
  exclude_user_id  UUID,
  min_quality      INT DEFAULT 3,
  result_count     INT DEFAULT 100
)
RETURNS TABLE (
  id                 UUID,
  user_id            UUID,
  intent             TEXT,
  sectors            TEXT[],
  geographies        TEXT[],
  deal_size_min_cr   NUMERIC,
  deal_size_max_cr   NUMERIC,
  revenue_min_cr     NUMERIC,
  revenue_max_cr     NUMERIC,
  deal_structure     TEXT,
  normalised_text    TEXT,
  raw_text           TEXT,
  fraud_flags        TEXT[],
  advisor_name       TEXT,
  contact_phone      TEXT,
  quality_tier       INTEGER,    -- INTEGER (not SMALLINT) to accept TEXT/NUMERIC/SMALLINT
  created_at         TIMESTAMPTZ,
  similarity         FLOAT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.intent,
    p.sectors,
    p.geographies,
    p.deal_size_min_cr,
    p.deal_size_max_cr,
    p.revenue_min_cr,
    p.revenue_max_cr,
    p.deal_structure,
    p.normalised_text,
    p.raw_text,
    p.fraud_flags,
    p.advisor_name,
    p.contact_phone,
    CAST(p.quality_tier AS INTEGER) AS quality_tier,   -- explicit cast prevents type mismatch
    p.created_at,
    1.0 - (p.embedding <=> query_embedding) AS similarity
  FROM proposals p
  WHERE
    p.status            = 'ACTIVE'
    AND p.embedding     IS NOT NULL
    AND p.embedding_status = 'DONE'
    AND CAST(p.quality_tier AS INTEGER) <= min_quality
    AND (p.user_id IS NULL OR p.user_id != exclude_user_id)
    AND p.intent        = ANY(match_intents)
    AND (1.0 - (p.embedding <=> query_embedding)) > 0.05   -- lowered from 0.10/0.12 to surface more candidates
  ORDER BY p.embedding <=> query_embedding
  LIMIT result_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_proposals TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_proposals TO anon;
GRANT EXECUTE ON FUNCTION public.match_proposals TO service_role;

-- ----------------------------------------------------------------
-- Also repair update_proposal_embedding (idempotent)
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_proposal_embedding(uuid, text);
DROP FUNCTION IF EXISTS public.update_proposal_embedding(uuid, vector);
DROP FUNCTION IF EXISTS public.update_proposal_embedding(uuid, vector(1536));

CREATE OR REPLACE FUNCTION public.update_proposal_embedding(
  proposal_id      UUID,
  embedding_vector vector(1536)
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE proposals
  SET embedding        = embedding_vector,
      embedding_status = 'DONE',
      updated_at       = NOW()
  WHERE id = proposal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_proposal_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_proposal_embedding TO anon;
GRANT EXECUTE ON FUNCTION public.update_proposal_embedding TO service_role;

-- ----------------------------------------------------------------
-- Ensure quality_tier column can accept integer values when written
-- via TypeScript (stored as numeric in many proposals).
-- This is a safe no-op if the column is already the right type.
-- ----------------------------------------------------------------
DO $$
BEGIN
  -- If quality_tier is TEXT, cast existing values and change type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'proposals'
      AND column_name  = 'quality_tier'
      AND data_type    = 'text'
  ) THEN
    -- Convert stored text '1','2','3','4' to integer
    ALTER TABLE proposals ALTER COLUMN quality_tier TYPE INTEGER USING CAST(quality_tier AS INTEGER);
    RAISE NOTICE 'quality_tier: TEXT → INTEGER migration complete';
  END IF;

  -- If quality_tier is NUMERIC, cast to INTEGER
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'proposals'
      AND column_name  = 'quality_tier'
      AND data_type    IN ('numeric', 'double precision', 'real')
  ) THEN
    ALTER TABLE proposals ALTER COLUMN quality_tier TYPE INTEGER USING CAST(quality_tier AS INTEGER);
    RAISE NOTICE 'quality_tier: NUMERIC → INTEGER migration complete';
  END IF;

  -- Set default so new rows always have a tier
  ALTER TABLE proposals ALTER COLUMN quality_tier SET DEFAULT 2;
END $$;

-- Also fix quality_score if it's TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'proposals'
      AND column_name  = 'quality_score'
      AND data_type    = 'text'
  ) THEN
    ALTER TABLE proposals ALTER COLUMN quality_score TYPE NUMERIC USING CAST(quality_score AS NUMERIC);
    RAISE NOTICE 'quality_score: TEXT → NUMERIC migration complete';
  END IF;
END $$;

-- ----------------------------------------------------------------
-- Rebuild the vector index if needed (CONCURRENTLY avoids table lock)
-- Increase lists to 150 for 2856+ proposals (rule: sqrt(rows) lists)
-- ----------------------------------------------------------------
DROP INDEX IF EXISTS idx_proposals_embedding;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_proposals_embedding
  ON proposals USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 150);

-- Composite indexes to accelerate the WHERE clause in match_proposals
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_proposals_active_embedded
  ON proposals (intent, quality_tier, status)
  WHERE status = 'ACTIVE' AND embedding_status = 'DONE' AND embedding IS NOT NULL;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
