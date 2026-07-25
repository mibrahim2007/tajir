-- ── Ask: stock-summary and overdue analytics ───────────────────────
-- Two more read-only, tenant-scoped functions for the Ask page (same rules as
-- migrations 0044/0045: language sql stable, tenant id as the first argument,
-- nothing inferred). Back the "stock summary" and "what's overdue" questions.

-- Inventory overview + a PKR valuation. Value per stockable item = quantity ×
-- its most-recent purchase rate (converted to PKR), falling back to opening_rate
-- — mirroring app/(app)/reports/stock-valuation. Service items are non-stockable
-- and excluded from units/value/stock counts.
create or replace function ask_stock_summary(p_tenant_id uuid)
returns table(total_items bigint, inventory_items bigint, service_items bigint,
              total_units numeric, total_value numeric,
              out_of_stock bigint, low_stock bigint)
language sql stable as $$
  with lots as (
    select
      il.id,
      il.current_quantity as qty,
      (il.item_nature = 'service') as is_service,
      coalesce(
        (select po.rate * (case when po.currency_code = 'USD' then po.exchange_rate else 1 end)
           from purchase_orders po
          where po.tenant_id = il.tenant_id and po.stock_item_id = il.id
          order by po.date desc, po.created_at desc
          limit 1),
        il.opening_rate, 0) as eff_rate
    from inventory_lots il
    where il.tenant_id = p_tenant_id
  )
  select
    count(*),
    count(*) filter (where not is_service),
    count(*) filter (where is_service),
    coalesce(sum(qty) filter (where not is_service), 0),
    coalesce(sum(qty * eff_rate) filter (where not is_service and qty > 0), 0),
    count(*) filter (where not is_service and qty <= 0),
    count(*) filter (where not is_service and qty > 0 and qty <= 5)
  from lots
$$;

-- Everything past its due date, both directions. Two sources:
--   • invoices past payment_due_date — reported per party as the overdue
--     exposure: least(outstanding, total of that party's past-due invoices). It
--     can never exceed what the party actually owes (GL-based, sum(debit−credit),
--     same basis as ask_receivables/ask_payables), so a party who has already
--     paced their old invoices off does not show.
--   • pending post-dated cheques past their cheque_due_date (from pdc_register).
-- `side`: 'receivable' = money you're owed / to collect; 'payable' = you owe / to pay.
create or replace function ask_overdue(p_tenant_id uuid, p_limit int)
returns table(party_name text, side text, kind text, reference text,
              due_date date, amount numeric)
language sql stable as $$
  -- Overdue receivable invoices (per customer)
  select b.name, 'receivable'::text, 'invoice'::text,
         'invoices due since ' || to_char(d.earliest_due, 'DD Mon YYYY'),
         d.earliest_due,
         least(b.outstanding, d.past_due_total) as amount
  from (
    select c.id, c.name, sum(jl.debit - jl.credit) as outstanding
    from tajir_customers c
    join tajir_journal_entry_lines jl on jl.customer_id = c.id and jl.tenant_id = c.tenant_id
    where c.tenant_id = p_tenant_id
    group by c.id, c.name
    having sum(jl.debit - jl.credit) > 0.01
  ) b
  join (
    select customer_id, min(payment_due_date) as earliest_due, sum(pkr_equivalent) as past_due_total
    from sales_orders
    where tenant_id = p_tenant_id and payment_due_date is not null and payment_due_date < current_date
    group by customer_id
  ) d on d.customer_id = b.id
  where least(b.outstanding, d.past_due_total) > 0.01

  union all

  -- Overdue payable invoices (per supplier)
  select b.name, 'payable'::text, 'invoice'::text,
         'invoices due since ' || to_char(d.earliest_due, 'DD Mon YYYY'),
         d.earliest_due,
         least(b.outstanding, d.past_due_total) as amount
  from (
    select s.id, s.name, sum(jl.credit - jl.debit) as outstanding
    from suppliers s
    join tajir_journal_entry_lines jl on jl.supplier_id = s.id and jl.tenant_id = s.tenant_id
    where s.tenant_id = p_tenant_id
    group by s.id, s.name
    having sum(jl.credit - jl.debit) > 0.01
  ) b
  join (
    select supplier_id, min(payment_due_date) as earliest_due, sum(pkr_equivalent) as past_due_total
    from purchase_orders
    where tenant_id = p_tenant_id and payment_due_date is not null and payment_due_date < current_date
    group by supplier_id
  ) d on d.supplier_id = b.id
  where least(b.outstanding, d.past_due_total) > 0.01

  union all

  -- Overdue pending cheques (in = to collect, out = to pay)
  select r.party_name,
         case when r.direction = 'in' then 'receivable' else 'payable' end,
         'cheque'::text,
         'cheque ' || coalesce(r.cheque_number, '—'),
         r.cheque_due_date,
         r.amount
  from pdc_register r
  where r.tenant_id = p_tenant_id
    and r.pdc_status = 'pending'
    and r.cheque_due_date is not null
    and r.cheque_due_date < current_date

  order by 2 desc, 5 asc nulls last, 6 desc
  limit p_limit
$$;
