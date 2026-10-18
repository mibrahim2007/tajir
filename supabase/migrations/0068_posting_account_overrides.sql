-- ── Posting accounts per business process ────────────────────────────────
-- Every document posts to the GL through standard accounts named by their
-- chart_of_accounts.system_key (Accounts Receivable, Sales Revenue, Stock in
-- Trade, …). This table lets a tenant redirect ONE of those standard heads, for
-- ONE business process, to another account of the same type in their chart —
-- e.g. post sale-invoice revenue to "Sales — Local" instead of "Sales Revenue".
--
-- No row = the standard head is used, so a tenant who never opens the screen
-- posts exactly as before. Overrides apply to documents posted (or re-posted on
-- edit) after the change; existing vouchers are not rewritten.
--
-- process is the journal entry's source_type (sale_invoice, ar_receipt, …);
-- system_key is the standard head being replaced. Which (process, system_key)
-- pairs may be overridden is decided by lib/accounting/posting-rules.ts.

create table if not exists public.posting_account_overrides (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  process     text not null,
  system_key  text not null,
  account_id  uuid not null references public.chart_of_accounts(id) on delete cascade,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  unique (tenant_id, process, system_key)
);

create index if not exists posting_account_overrides_tenant_process_idx
  on public.posting_account_overrides (tenant_id, process);

-- Read-only to the tenant; writes go through the owner-gated server action.
alter table public.posting_account_overrides enable row level security;

drop policy if exists "posting_account_overrides: tenant select" on public.posting_account_overrides;
create policy "posting_account_overrides: tenant select" on public.posting_account_overrides for select
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
