
-- P1a: Enable RLS on admin_users
-- service_role bypasses RLS by default in Supabase.
-- No permissive policy for authenticated/anon means they see zero rows.
-- Explicit service_role policy documents intent.
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_users_service_role_only"
  ON public.admin_users
  FOR SELECT
  TO service_role
  USING (true);

-- P1b: Enable RLS on gatepasses with tenant-scoped policies
ALTER TABLE public.gatepasses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gatepasses_tenant_select"
  ON public.gatepasses
  FOR SELECT
  TO authenticated
  USING (tenant_id = ((auth.jwt()->'app_metadata'->>'tenant_id')::uuid));

CREATE POLICY "gatepasses_tenant_insert"
  ON public.gatepasses
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = ((auth.jwt()->'app_metadata'->>'tenant_id')::uuid));

CREATE POLICY "gatepasses_tenant_update"
  ON public.gatepasses
  FOR UPDATE
  TO authenticated
  USING (tenant_id = ((auth.jwt()->'app_metadata'->>'tenant_id')::uuid))
  WITH CHECK (tenant_id = ((auth.jwt()->'app_metadata'->>'tenant_id')::uuid));
