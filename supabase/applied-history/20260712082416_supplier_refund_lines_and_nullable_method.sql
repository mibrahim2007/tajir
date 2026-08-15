-- Split-tender lines for supplier refunds (money received back from a supplier),
-- mirroring ap_payment_lines. Service-role only: RLS enabled, no policies.
create table if not exists public.supplier_refund_lines (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  refund_id        uuid not null references public.supplier_refunds(id) on delete cascade,
  line_no          integer not null default 1,
  transaction_type text not null,
  cheque_number    text,
  bank_id          uuid,
  amount           numeric not null,
  created_at       timestamptz not null default now()
);

alter table public.supplier_refund_lines enable row level security;

create index if not exists supplier_refund_lines_refund_id_idx on public.supplier_refund_lines(refund_id);
create index if not exists supplier_refund_lines_tenant_id_idx on public.supplier_refund_lines(tenant_id);

-- A lined refund has no single payment method; the breakdown lives in the lines.
alter table public.supplier_refunds alter column payment_method drop not null;