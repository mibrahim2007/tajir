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