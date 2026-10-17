-- ── Receipt against sale invoice (optional) ─────────────────────────────
-- Until now a receipt was never tied to an invoice: every report settled
-- payments oldest-invoice-first (FIFO). Traders often get paid for a specific
-- bill, though, and want the invoice-wise pending list to show exactly that.
--
-- An allocation applies part of a receipt to one sale invoice. It is optional
-- and partial: whatever part of a receipt is not allocated keeps settling the
-- oldest open invoices FIFO, exactly as before. Allocations post nothing to
-- the GL — the receipt's own entry (CR Accounts Receivable) is unchanged; this
-- only decides WHICH invoice that credit settles.
--
-- invoice_key is sales_orders.invoice_id, or for a legacy single-line sale
-- that predates invoice_id, that row's own id (the `invoice_id ?? id`
-- convention used by the sale reports). There is no invoice header table to
-- reference, so it carries no foreign key: an allocation whose invoice has been
-- deleted is simply treated as unallocated by the reports.
--
-- amount is in PKR (the invoice side is tracked in pkr_equivalent).

create table if not exists public.ar_receipt_allocations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  receipt_id  uuid not null references public.ar_receipts(id) on delete cascade,
  customer_id uuid not null references public.tajir_customers(id) on delete cascade,
  invoice_key uuid not null,
  amount      numeric(15,2) not null check (amount > 0),
  created_at  timestamptz not null default now(),
  unique (receipt_id, invoice_key)
);

create index if not exists ar_receipt_allocations_tenant_customer_idx
  on public.ar_receipt_allocations (tenant_id, customer_id);
create index if not exists ar_receipt_allocations_invoice_idx
  on public.ar_receipt_allocations (tenant_id, invoice_key);

-- Tenant-isolation RLS, mirroring ar_receipt_lines.
alter table public.ar_receipt_allocations enable row level security;

drop policy if exists "ar_receipt_allocations: tenant select" on public.ar_receipt_allocations;
drop policy if exists "ar_receipt_allocations: tenant insert" on public.ar_receipt_allocations;
drop policy if exists "ar_receipt_allocations: tenant update" on public.ar_receipt_allocations;
drop policy if exists "ar_receipt_allocations: tenant delete" on public.ar_receipt_allocations;

create policy "ar_receipt_allocations: tenant select" on public.ar_receipt_allocations for select
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "ar_receipt_allocations: tenant insert" on public.ar_receipt_allocations for insert
  with check (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "ar_receipt_allocations: tenant update" on public.ar_receipt_allocations for update
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "ar_receipt_allocations: tenant delete" on public.ar_receipt_allocations for delete
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
