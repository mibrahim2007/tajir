
-- Migration 1: tenants, tenant_users with RLS

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'grace_period', 'locked', 'cancelled')),
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'assistant')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tenant_users_tenant_role_idx
  ON tenant_users (tenant_id, role)
  WHERE role = 'assistant' AND is_active = true;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- Tenants: authenticated users access only their own tenant row
CREATE POLICY "tenants_select_own" ON tenants
  FOR SELECT TO authenticated
  USING (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "tenants_update_own" ON tenants
  FOR UPDATE TO authenticated
  USING (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

-- tenant_users: scoped to the authenticated user's tenant
CREATE POLICY "tenant_users_select_own" ON tenant_users
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "tenant_users_insert_own" ON tenant_users
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "tenant_users_update_own" ON tenant_users
  FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
