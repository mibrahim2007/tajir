
-- Drop the overly-permissive public-role INSERT policy (WITH CHECK (true))
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Recreate restricted to authenticated role, scoped to org membership.
-- audit_logs uses org_id (old schema). Inserts must come from authenticated
-- users who are members of the target org.
CREATE POLICY "authenticated_insert_audit_logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(org_id));

-- public.audit_log (Tajir schema) already has a correct tenant-scoped INSERT
-- policy (audit_log_insert_own for authenticated role) — no change needed.
