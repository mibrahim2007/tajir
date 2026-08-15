CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.ask_query_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       uuid,
  question      text NOT NULL,
  normalized    text NOT NULL,
  answer_kind   text,
  answer_title  text,
  answered      boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ask_query_log_tenant_time
  ON public.ask_query_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ask_query_log_normalized_trgm
  ON public.ask_query_log USING gin (normalized gin_trgm_ops);

ALTER TABLE public.ask_query_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION ask_similar_questions(
  p_tenant_id uuid,
  p_question  text,
  p_limit     int DEFAULT 5
)
RETURNS TABLE(question text, answer_kind text, answer_title text, hits bigint, score real)
LANGUAGE sql STABLE AS $$
  SELECT
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