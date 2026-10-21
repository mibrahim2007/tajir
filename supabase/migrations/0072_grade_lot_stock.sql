-- ── Grade- and lot-wise stock ────────────────────────────────────────────────
--
-- A yarn receipt is not just "item × quantity": the same 150/144 polyester
-- arrives as AA-Even from one supplier and A-Uneven from another, each lot
-- lands in a different godown, and cartons are counted alongside kilograms.
-- 0071 put the measuring rules on the item type (formula, pack unit, standard
-- weight, track_grade, track_lot). This migration gives every stock movement
-- the attributes those flags ask for:
--
--   grades            per-tenant grade list (AA-Even, A-Uneven, …)
--   grade_id, lot_no  on purchase / sale lines, both returns, stock transfers
--                     and opening balances
--   nos_carton, …     carton fields on the returns (purchase and sale lines
--                     already had them since 0031) and on transfers / opening
--
-- Stock is still derived from the document tables (no ledger table yet): the
-- new stock_position view sums every movement per item × location × grade ×
-- lot, in stock units and in packs. location_stock_summary keeps its shape and
-- now sums opening rows, since a location can hold several grade/lot rows.
--
-- All new columns are nullable: items whose type doesn't track grade or lot
-- simply leave them empty and behave exactly as before.

-- ── grades ───────────────────────────────────────────────────────────────────
create table if not exists public.grades (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint grades_tenant_id_name_key unique (tenant_id, name)
);
create index if not exists idx_grades_tenant on public.grades (tenant_id);
-- Service-role access only (server actions scope by tenant_id).
alter table public.grades enable row level security;

-- ── line attributes ──────────────────────────────────────────────────────────
-- A grade in use can't be deleted (RESTRICT); lot numbers are free text so a
-- supplier's own lot number can be kept as printed.
alter table public.purchase_orders
  add column if not exists grade_id uuid references public.grades(id) on delete restrict,
  add column if not exists lot_no   text;

alter table public.sales_orders
  add column if not exists grade_id uuid references public.grades(id) on delete restrict,
  add column if not exists lot_no   text;

alter table public.purchase_returns
  add column if not exists grade_id          uuid references public.grades(id) on delete restrict,
  add column if not exists lot_no            text,
  add column if not exists nos_carton        numeric(15,4),
  add column if not exists weight_per_carton numeric(15,4),
  add column if not exists qty_lbs           numeric(15,4);

alter table public.sale_returns
  add column if not exists grade_id          uuid references public.grades(id) on delete restrict,
  add column if not exists lot_no            text,
  add column if not exists nos_carton        numeric(15,4),
  add column if not exists weight_per_carton numeric(15,4),
  add column if not exists qty_lbs           numeric(15,4);

alter table public.stock_transfers
  add column if not exists grade_id   uuid references public.grades(id) on delete restrict,
  add column if not exists lot_no     text,
  add column if not exists nos_carton numeric(15,4);

alter table public.stock_opening_balances
  add column if not exists grade_id          uuid references public.grades(id) on delete restrict,
  add column if not exists lot_no            text,
  add column if not exists nos_carton        numeric(15,4),
  add column if not exists weight_per_carton numeric(15,4);

-- Opening stock is now one row per item × location × grade × lot.
drop index if exists public.uq_stock_opening_balances_item_location;
create unique index if not exists uq_stock_opening_balances_position
  on public.stock_opening_balances (
    tenant_id, stock_item_id, location_id,
    coalesce(grade_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(lot_no, '')
  );

create index if not exists idx_purchase_orders_position on public.purchase_orders (tenant_id, stock_item_id, location_id);
create index if not exists idx_sales_orders_position    on public.sales_orders    (tenant_id, stock_item_id, location_id);

-- ── stock_position ───────────────────────────────────────────────────────────
-- On-hand stock per item × location × grade × lot. `quantity` is in the item's
-- stock unit (kg for weighed yarn, Nos for count items); `packs` counts
-- cartons / bags where the lines recorded them. Rows that net to zero in both
-- are dropped. Movements without a location (legacy rows, service lines) are
-- not attributable to a godown and are left out, as in location_stock_summary.
drop view if exists public.stock_position;
create view public.stock_position with (security_invoker = on) as
select
  m.tenant_id,
  m.stock_item_id,
  m.location_id,
  m.grade_id,
  m.lot_no,
  sum(m.qty)   as quantity,
  sum(m.packs) as packs
from (
  select tenant_id, stock_item_id, location_id, grade_id, nullif(lot_no, '') as lot_no,
         quantity as qty, coalesce(nos_carton, 0) as packs
    from public.purchase_orders
  union all
  select tenant_id, stock_item_id, location_id, grade_id, nullif(lot_no, ''),
         -quantity, -coalesce(nos_carton, 0)
    from public.sales_orders
  union all
  select tenant_id, stock_item_id, location_id, grade_id, nullif(lot_no, ''),
         quantity, coalesce(nos_carton, 0)
    from public.sale_returns
  union all
  select tenant_id, stock_item_id, location_id, grade_id, nullif(lot_no, ''),
         -quantity, -coalesce(nos_carton, 0)
    from public.purchase_returns
  union all
  select tenant_id, stock_item_id, to_location_id, grade_id, nullif(lot_no, ''),
         quantity, coalesce(nos_carton, 0)
    from public.stock_transfers
  union all
  select tenant_id, stock_item_id, from_location_id, grade_id, nullif(lot_no, ''),
         -quantity, -coalesce(nos_carton, 0)
    from public.stock_transfers
  union all
  select tenant_id, stock_item_id, location_id, grade_id, nullif(lot_no, ''),
         quantity, coalesce(nos_carton, 0)
    from public.stock_opening_balances
) m
where m.location_id is not null
group by m.tenant_id, m.stock_item_id, m.location_id, m.grade_id, m.lot_no
having sum(m.qty) <> 0 or sum(m.packs) <> 0;

-- ── location_stock_summary: same columns, opening rows summed ───────────────
drop view if exists public.location_stock_summary;
create view public.location_stock_summary with (security_invoker = on) as
select
  il.id   as stock_item_id,
  il.tenant_id,
  il.name as stock_item_name,
  il.count::text as yarn_count,
  l.id    as location_id,
  l.name  as location_name,
  (
    coalesce((select sum(po.quantity) from purchase_orders po
      where po.stock_item_id = il.id and po.location_id = l.id and po.tenant_id = il.tenant_id), 0)
  - coalesce((select sum(so.quantity) from sales_orders so
      where so.stock_item_id = il.id and so.location_id = l.id and so.tenant_id = il.tenant_id), 0)
  + coalesce((select sum(sr.quantity) from sale_returns sr
      where sr.stock_item_id = il.id and sr.location_id = l.id and sr.tenant_id = il.tenant_id), 0)
  - coalesce((select sum(pr.quantity) from purchase_returns pr
      where pr.stock_item_id = il.id and pr.location_id = l.id and pr.tenant_id = il.tenant_id), 0)
  + coalesce((select sum(st.quantity) from stock_transfers st
      where st.stock_item_id = il.id and st.to_location_id = l.id and st.tenant_id = il.tenant_id), 0)
  - coalesce((select sum(st.quantity) from stock_transfers st
      where st.stock_item_id = il.id and st.from_location_id = l.id and st.tenant_id = il.tenant_id), 0)
  + coalesce((select sum(sob.quantity) from stock_opening_balances sob
      where sob.stock_item_id = il.id and sob.location_id = l.id and sob.tenant_id = il.tenant_id), 0)
  ) as quantity
from inventory_lots il
join locations l on l.tenant_id = il.tenant_id;

notify pgrst, 'reload schema';
