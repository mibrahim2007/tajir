ALTER TABLE public.tenant_users
  ADD COLUMN IF NOT EXISTS username text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_tenant_users_username ON public.tenant_users (username);
