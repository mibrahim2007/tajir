-- ============================================================
-- 0009: Make username unique per tenant instead of globally
-- The global UNIQUE on tenant_users.username blocked registration
-- if any other tenant already had the same username (e.g. "admin").
-- Username only needs to be unique within a single tenant.
-- ============================================================
ALTER TABLE public.tenant_users DROP CONSTRAINT IF EXISTS tenant_users_username_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_users_username
  ON public.tenant_users (tenant_id, username)
  WHERE username IS NOT NULL;
