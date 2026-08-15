
-- ============================================================
-- Fix RLS infinite recursion on org_members
-- All membership checks now go through a security definer
-- function that bypasses RLS, breaking the circular reference.
-- ============================================================

-- Helper: check if current user belongs to an org (bypasses RLS)
CREATE OR REPLACE FUNCTION is_org_member(org_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = org_uuid AND user_id = auth.uid()
  );
$$;

-- Helper: check if current user has a given role (or higher) in an org
CREATE OR REPLACE FUNCTION is_org_member_with_role(org_uuid uuid, required_roles user_role[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = org_uuid
      AND user_id = auth.uid()
      AND role = ANY(required_roles)
  );
$$;

-- ---- organizations ----
DROP POLICY IF EXISTS "Users can view their orgs" ON organizations;
DROP POLICY IF EXISTS "Owners can update their org" ON organizations;

CREATE POLICY "Users can view their orgs" ON organizations
  FOR SELECT USING (is_org_member(id));

CREATE POLICY "Owners can update their org" ON organizations
  FOR UPDATE USING (owner_id = auth.uid());

-- ---- org_members ----
DROP POLICY IF EXISTS "Members can view their org members" ON org_members;
DROP POLICY IF EXISTS "Admins can manage members" ON org_members;

CREATE POLICY "Members can view their org members" ON org_members
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "Admins can manage members" ON org_members
  FOR ALL USING (
    is_org_member_with_role(org_id, ARRAY['OWNER','ADMIN']::user_role[])
  );

-- ---- accounts ----
DROP POLICY IF EXISTS "Org members can view accounts" ON accounts;
DROP POLICY IF EXISTS "Accountants+ can manage accounts" ON accounts;

CREATE POLICY "Org members can view accounts" ON accounts
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "Accountants+ can manage accounts" ON accounts
  FOR ALL USING (
    is_org_member_with_role(org_id, ARRAY['OWNER','ADMIN','ACCOUNTANT']::user_role[])
  );

-- ---- journal_entries ----
DROP POLICY IF EXISTS "Org members can view entries" ON journal_entries;
DROP POLICY IF EXISTS "Accountants+ can create entries" ON journal_entries;
DROP POLICY IF EXISTS "Accountants+ can update draft entries" ON journal_entries;

CREATE POLICY "Org members can view entries" ON journal_entries
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "Accountants+ can create entries" ON journal_entries
  FOR INSERT WITH CHECK (
    is_org_member_with_role(org_id, ARRAY['OWNER','ADMIN','ACCOUNTANT']::user_role[])
  );

CREATE POLICY "Accountants+ can update draft entries" ON journal_entries
  FOR UPDATE USING (
    status = 'DRAFT' AND
    is_org_member_with_role(org_id, ARRAY['OWNER','ADMIN','ACCOUNTANT']::user_role[])
  );

-- ---- entry_lines ----
DROP POLICY IF EXISTS "Members can view entry lines" ON entry_lines;
DROP POLICY IF EXISTS "Accountants+ can manage entry lines" ON entry_lines;

CREATE POLICY "Members can view entry lines" ON entry_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = entry_lines.entry_id
        AND is_org_member(je.org_id)
    )
  );

CREATE POLICY "Accountants+ can manage entry lines" ON entry_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = entry_lines.entry_id
        AND is_org_member_with_role(je.org_id, ARRAY['OWNER','ADMIN','ACCOUNTANT']::user_role[])
    )
  );

-- ---- audit_logs ----
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;

CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT USING (
    is_org_member_with_role(org_id, ARRAY['OWNER','ADMIN','AUDITOR']::user_role[])
  );

-- ---- subscriptions ----
DROP POLICY IF EXISTS "Members can view subscription" ON subscriptions;

CREATE POLICY "Members can view subscription" ON subscriptions
  FOR SELECT USING (is_org_member(org_id));

-- ---- attachments ----
DROP POLICY IF EXISTS "Members can view attachments" ON attachments;

CREATE POLICY "Members can view attachments" ON attachments
  FOR SELECT USING (is_org_member(org_id));
