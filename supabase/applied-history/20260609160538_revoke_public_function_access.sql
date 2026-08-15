
-- The previous REVOKE from anon/authenticated was ineffective because
-- EXECUTE was granted to PUBLIC (all roles inherit it).
-- Correct fix: revoke from PUBLIC, then re-grant only to legitimate roles.

-- adjust_inventory_quantity: only authenticated (called by app logic)
REVOKE EXECUTE ON FUNCTION public.adjust_inventory_quantity(uuid, numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.adjust_inventory_quantity(uuid, numeric) TO authenticated;

-- get_account_balance: old-schema function, org-member-scoped; authenticated only
REVOKE EXECUTE ON FUNCTION public.get_account_balance(uuid, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_account_balance(uuid, date) TO authenticated;

-- is_org_member: used inside RLS policies; must be accessible to authenticated
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;

-- is_org_member_with_role: used inside RLS policies; authenticated only
REVOKE EXECUTE ON FUNCTION public.is_org_member_with_role(uuid, public.user_role[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_org_member_with_role(uuid, public.user_role[]) TO authenticated;

-- handle_new_user: internal trigger function — no client role should call it
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- prevent_audit_log_modification: internal trigger function — no client role needed
REVOKE EXECUTE ON FUNCTION public.prevent_audit_log_modification() FROM PUBLIC;
