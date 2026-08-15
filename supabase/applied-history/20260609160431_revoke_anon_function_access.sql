
-- Revoke EXECUTE from anon on all dangerous functions
REVOKE EXECUTE ON FUNCTION public.adjust_inventory_quantity(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_account_balance(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member_with_role(uuid, public.user_role[]) FROM anon;

-- Revoke from both anon and authenticated for trigger/internal functions
-- that should never be called directly by any client role
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_audit_log_modification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_audit_log_modification() FROM authenticated;
