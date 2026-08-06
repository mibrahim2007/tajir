-- ============================================================
-- 0056: Ask question history
--
-- Every question typed into Ask is recorded per tenant, so that the next
-- person to ask something similar gets the benefit of it. Two uses:
--
--   • recall — when the engine cannot match a question, look for one this
--     tenant HAS had answered before and offer it, instead of the generic
--     "here are some examples" fallback
--   • reference — the questions a tenant actually asks are the real spec for
--     what Ask should cover; scripts/ask-history-export.ts turns them into a
--     text file
--
-- Similarity is trigram-based (pg_trgm), not a model: same-tenant, explainable,
-- and it keeps the engine's "nothing is inferred" property intact.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.ask_query_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Who asked. Kept nullable so a deleted user does not delete the history.
  user_id       uuid,
  -- As typed, for the reference file.
  question      text NOT NULL,
  -- Lowercased and stripped, for matching. See lib/ask/history.ts.
  normalized    text NOT NULL,
  -- How it was answered: the AskResponse kind and title, so a recalled
  -- question can say what it produced last time.
  answer_kind   text,
  answer_title  text,
  -- False when the engine fell through to the generic help answer. Only
  -- answered questions are worth recalling.
  answered      boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ask_query_log_tenant_time
  ON public.ask_query_log(tenant_id, created_at DESC);

-- Trigram index is what makes similarity search cheap.
CREATE INDEX IF NOT EXISTS idx_ask_query_log_normalized_trgm
  ON public.ask_query_log USING gin (normalized gin_trgm_ops);

-- Access is only ever through the service-role admin client inside server
-- actions (which scope by tenant_id). Enable RLS with no policies so the
-- anon/authenticated roles are denied by default, matching every other table.
ALTER TABLE public.ask_query_log ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Questions this tenant has asked before that resemble a new one.
--
-- Grouped by the normalized form so a question asked twenty times comes back
-- once, carrying how often it was asked — popularity is a better tie-breaker
-- than recency when two past questions match equally well.
--
-- Read-only and tenant-scoped, like every other ask_* function.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ask_similar_questions(
  p_tenant_id uuid,
  p_question  text,
  p_limit     int DEFAULT 5
)
RETURNS TABLE(question text, answer_kind text, answer_title text, hits bigint, score real)
LANGUAGE sql STABLE AS $$
  SELECT
    -- The most recent phrasing of this question is the one shown back.
    (array_agg(l.question ORDER BY l.created_at DESC))[1] AS question,
    (array_agg(l.answer_kind ORDER BY l.created_at DESC))[1] AS answer_kind,
    (array_agg(l.answer_title ORDER BY l.created_at DESC))[1] AS answer_title,
    count(*) AS hits,
    max(similarity(l.normalized, p_question)) AS score
  FROM ask_query_log l
  WHERE l.tenant_id = p_tenant_id
    AND l.answered
    AND l.normalized <> p_question
    AND similarity(l.normalized, p_question) > 0.3
  GROUP BY l.normalized
  ORDER BY max(similarity(l.normalized, p_question)) DESC, count(*) DESC
  LIMIT p_limit
$$;

-- ------------------------------------------------------------
-- What this tenant asks most. Powers the reference file and could later
-- replace the hard-coded example chips with the tenant's own questions.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ask_top_questions(
  p_tenant_id uuid,
  p_limit     int DEFAULT 100
)
RETURNS TABLE(question text, answer_kind text, answer_title text, answered boolean, hits bigint, last_asked timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT
    (array_agg(l.question ORDER BY l.created_at DESC))[1] AS question,
    (array_agg(l.answer_kind ORDER BY l.created_at DESC))[1] AS answer_kind,
    (array_agg(l.answer_title ORDER BY l.created_at DESC))[1] AS answer_title,
    bool_or(l.answered) AS answered,
    count(*) AS hits,
    max(l.created_at) AS last_asked
  FROM ask_query_log l
  WHERE l.tenant_id = p_tenant_id
  GROUP BY l.normalized
  ORDER BY count(*) DESC, max(l.created_at) DESC
  LIMIT p_limit
$$;
