
-- Set search_path = public on all functions that were missing it.
-- handle_new_user already has search_path set — excluded.

ALTER FUNCTION public.adjust_inventory_quantity(uuid, numeric) SET search_path = public;
ALTER FUNCTION public.check_posting_balance() SET search_path = public;
ALTER FUNCTION public.get_account_balance(uuid, date) SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.is_org_member(uuid) SET search_path = public;
ALTER FUNCTION public.is_org_member_with_role(uuid, public.user_role[]) SET search_path = public;
ALTER FUNCTION public.prevent_audit_log_modification() SET search_path = public;
ALTER FUNCTION public.get_next_voucher_number(uuid, text) SET search_path = public;
ALTER FUNCTION public.seed_standard_coa(uuid) SET search_path = public;
