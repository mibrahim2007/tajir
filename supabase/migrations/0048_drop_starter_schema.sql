-- Remove the unused Supabase SaaS-starter schema (org-based): Tajir never
-- adopted it — the app uses tenants / tenant_users / tajir_* instead. Confirmed
-- fully unused before dropping: no Tajir table, view, function, policy or trigger
-- references any of it (every dependent policy/trigger/function belongs to the
-- starter schema itself). Migration 0047 was the non-destructive stop-gap that
-- unblocked auth-user deletion; this removes the cruft entirely.
--
-- Dropped: 13 tables, 2 views (ap_aging/ar_aging), 4 helper functions.
-- Note pdc_register is a REAL Tajir view and does NOT depend on any of these
-- (it reads ar_receipts/tajir_customers/… — only substring-matched "customers").

drop view if exists public.ap_aging;
drop view if exists public.ar_aging;

drop table if exists public.entry_lines     cascade;
drop table if exists public.invoice_lines   cascade;
drop table if exists public.journal_entries cascade;
drop table if exists public.invoices        cascade;
drop table if exists public.payments        cascade;
drop table if exists public.attachments     cascade;
drop table if exists public.audit_logs      cascade;
drop table if exists public.customers       cascade;
drop table if exists public.vendors         cascade;
drop table if exists public.accounts        cascade;
drop table if exists public.subscriptions   cascade;
drop table if exists public.org_members     cascade;
drop table if exists public.organizations   cascade;

drop function if exists public.check_posting_balance()                    cascade;
drop function if exists public.get_account_balance(uuid, date)            cascade;
drop function if exists public.is_org_member(uuid)                        cascade;
drop function if exists public.is_org_member_with_role(uuid, user_role[]) cascade;
