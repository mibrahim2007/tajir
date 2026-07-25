-- Fix: deleting an auth user failed app-wide ("Database error deleting user"),
-- breaking assistant removal (manage-assistant), demo-data cleanup, etc.
--
-- Cause: a leftover Supabase SaaS-starter schema (org-based: organizations,
-- org_members, subscriptions, journal_entries, invoices, audit_logs, …) that
-- Tajir never adopted — it uses tenants / tenant_users / tajir_* instead. An
-- AFTER INSERT trigger on auth.users (handle_new_user) created an organization +
-- org_member + subscription on EVERY signup, and those rows FK-reference
-- auth.users with NO ACTION, so Postgres refused to delete any user.
--
-- Fix without dropping the (unused) tables — reversible, and no Tajir table
-- references these: (1) stop the trigger so no new boilerplate rows are made;
-- (2) make each starter table's FK to auth.users ON DELETE CASCADE so deleting a
-- user cleans up its own boilerplate rows (their child rows already cascade).

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

alter table public.organizations  drop constraint if exists organizations_owner_id_fkey;
alter table public.organizations  add  constraint organizations_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete cascade;

alter table public.org_members     drop constraint if exists org_members_user_id_fkey;
alter table public.org_members     add  constraint org_members_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.journal_entries drop constraint if exists journal_entries_created_by_fkey;
alter table public.journal_entries add  constraint journal_entries_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete cascade;

alter table public.invoices        drop constraint if exists invoices_created_by_fkey;
alter table public.invoices        add  constraint invoices_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete cascade;

alter table public.audit_logs      drop constraint if exists audit_logs_user_id_fkey;
alter table public.audit_logs      add  constraint audit_logs_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
