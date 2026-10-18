-- ── Payment against purchase invoice (optional) ─────────────────────────
-- Supplier-side mirror of 0066_receipt_invoice_allocations. An allocation
-- applies part of a supplier payment to one purchase invoice. It is optional
-- and partial: whatever part of a payment is not allocated keeps settling the
-- oldest open bills FIFO, exactly as before. Allocations post nothing to the
-- GL — the payment's own entry (DR Accounts Payable) is unchanged; this only
-- decides WHICH bill that debit settles.
--
-- invoice_key is purchase_orders.invoice_id, or for a legacy single-line
-- purchase that predates invoice_id, that row's own id. There is no invoice
-- header table to reference, so it carries no foreign key: an allocation whose
-- invoice has been deleted is simply treated as unallocated by the reports.
--
-- amount is in PKR (the invoice side is tracked in pkr_equivalent).

create table if not exists public.ap_payment_allocations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  payment_id  uuid not null references public.ap_payments(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  invoice_key uuid not null,
  amount      numeric(15,2) not null check (amount > 0),
  created_at  timestamptz not null default now(),
  unique (payment_id, invoice_key)
);

create index if not exists ap_payment_allocations_tenant_supplier_idx
  on public.ap_payment_allocations (tenant_id, supplier_id);
create index if not exists ap_payment_allocations_invoice_idx
  on public.ap_payment_allocations (tenant_id, invoice_key);

-- Tenant-isolation RLS, mirroring ap_payment_lines.
alter table public.ap_payment_allocations enable row level security;

drop policy if exists "ap_payment_allocations: tenant select" on public.ap_payment_allocations;
drop policy if exists "ap_payment_allocations: tenant insert" on public.ap_payment_allocations;
drop policy if exists "ap_payment_allocations: tenant update" on public.ap_payment_allocations;
drop policy if exists "ap_payment_allocations: tenant delete" on public.ap_payment_allocations;

create policy "ap_payment_allocations: tenant select" on public.ap_payment_allocations for select
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "ap_payment_allocations: tenant insert" on public.ap_payment_allocations for insert
  with check (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "ap_payment_allocations: tenant update" on public.ap_payment_allocations for update
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "ap_payment_allocations: tenant delete" on public.ap_payment_allocations for delete
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
