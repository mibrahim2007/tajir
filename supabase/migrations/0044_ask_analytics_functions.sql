-- ── Ask: read-only analytics functions ─────────────────────────────
-- Back the natural-language "Ask" page. Every function is READ-ONLY, takes the
-- caller's tenant id as its first argument, and filters on it — the page never
-- lets the browser choose the tenant, it passes the authenticated one. Doing
-- the aggregation in SQL (rather than the JS client, which caps at 1000 rows)
-- keeps totals correct on large ledgers.
--
-- Nothing here infers or invents: each function only reports rows already in
-- the tables.

-- Customer ledger — every GL movement carrying this customer's dimension.
create or replace function ask_customer_ledger(p_tenant_id uuid, p_customer_id uuid)
returns table(entry_date date, voucher text, description text, debit numeric, credit numeric)
language sql stable as $$
  select je.date, je.voucher_number, je.description, jl.debit, jl.credit
  from tajir_journal_entry_lines jl
  join tajir_journal_entries je on je.id = jl.journal_entry_id
  where jl.tenant_id = p_tenant_id and jl.customer_id = p_customer_id
  order by je.date, je.created_at, je.voucher_number
$$;

-- Supplier ledger — the payable side of the same idea.
create or replace function ask_supplier_ledger(p_tenant_id uuid, p_supplier_id uuid)
returns table(entry_date date, voucher text, description text, debit numeric, credit numeric)
language sql stable as $$
  select je.date, je.voucher_number, je.description, jl.debit, jl.credit
  from tajir_journal_entry_lines jl
  join tajir_journal_entries je on je.id = jl.journal_entry_id
  where jl.tenant_id = p_tenant_id and jl.supplier_id = p_supplier_id
  order by je.date, je.created_at, je.voucher_number
$$;

-- Item ledger — physical stock movements (quantities, not money).
create or replace function ask_item_ledger(p_tenant_id uuid, p_item_id uuid)
returns table(entry_date date, kind text, reference text, qty_in numeric, qty_out numeric)
language sql stable as $$
  select date, 'Purchase'::text, serial_number, quantity, 0::numeric
    from purchase_orders where tenant_id = p_tenant_id and stock_item_id = p_item_id
  union all
  select date, 'Sale', serial_number, 0, quantity
    from sales_orders where tenant_id = p_tenant_id and stock_item_id = p_item_id
  union all
  select date, 'Purchase Return', serial_number, 0, quantity
    from purchase_returns where tenant_id = p_tenant_id and stock_item_id = p_item_id
  union all
  select date, 'Sale Return', serial_number, quantity, 0
    from sale_returns where tenant_id = p_tenant_id and stock_item_id = p_item_id
  order by 1, 3
$$;

-- Customer business summary — the headline numbers for one customer.
create or replace function ask_customer_summary(p_tenant_id uuid, p_customer_id uuid)
returns table(total_sales numeric, sales_qty numeric, order_count bigint,
              total_received numeric, returns_value numeric, balance numeric,
              first_order date, last_order date)
language sql stable as $$
  select
    coalesce((select sum(pkr_equivalent) from sales_orders where tenant_id=p_tenant_id and customer_id=p_customer_id),0),
    coalesce((select sum(quantity) from sales_orders where tenant_id=p_tenant_id and customer_id=p_customer_id),0),
    (select count(distinct serial_number) from sales_orders where tenant_id=p_tenant_id and customer_id=p_customer_id),
    coalesce((select sum(pkr_equivalent) from ar_receipts where tenant_id=p_tenant_id and customer_id=p_customer_id),0),
    coalesce((select sum(pkr_equivalent) from sale_returns where tenant_id=p_tenant_id and customer_id=p_customer_id),0),
    coalesce((select sum(debit-credit) from tajir_journal_entry_lines where tenant_id=p_tenant_id and customer_id=p_customer_id),0),
    (select min(date) from sales_orders where tenant_id=p_tenant_id and customer_id=p_customer_id),
    (select max(date) from sales_orders where tenant_id=p_tenant_id and customer_id=p_customer_id)
$$;

-- Supplier business summary — the mirror for a supplier.
create or replace function ask_supplier_summary(p_tenant_id uuid, p_supplier_id uuid)
returns table(total_purchases numeric, purchase_qty numeric, order_count bigint,
              total_paid numeric, returns_value numeric, balance numeric,
              first_order date, last_order date)
language sql stable as $$
  select
    coalesce((select sum(pkr_equivalent) from purchase_orders where tenant_id=p_tenant_id and supplier_id=p_supplier_id),0),
    coalesce((select sum(quantity) from purchase_orders where tenant_id=p_tenant_id and supplier_id=p_supplier_id),0),
    (select count(distinct serial_number) from purchase_orders where tenant_id=p_tenant_id and supplier_id=p_supplier_id),
    coalesce((select sum(pkr_equivalent) from ap_payments where tenant_id=p_tenant_id and supplier_id=p_supplier_id),0),
    coalesce((select sum(pkr_equivalent) from purchase_returns where tenant_id=p_tenant_id and supplier_id=p_supplier_id),0),
    coalesce((select sum(credit-debit) from tajir_journal_entry_lines where tenant_id=p_tenant_id and supplier_id=p_supplier_id),0),
    (select min(date) from purchase_orders where tenant_id=p_tenant_id and supplier_id=p_supplier_id),
    (select max(date) from purchase_orders where tenant_id=p_tenant_id and supplier_id=p_supplier_id)
$$;

-- Slow-moving items — least sold in the window, with stock still on hand.
create or replace function ask_slow_items(p_tenant_id uuid, p_days int, p_limit int)
returns table(name text, current_quantity numeric, sold_qty numeric, last_sold date)
language sql stable as $$
  select il.name, il.current_quantity,
         coalesce(sum(so.quantity) filter (where so.date >= current_date - p_days), 0) as sold_qty,
         max(so.date) as last_sold
  from inventory_lots il
  left join sales_orders so on so.stock_item_id = il.id and so.tenant_id = il.tenant_id
  where il.tenant_id = p_tenant_id
  group by il.id, il.name, il.current_quantity
  order by sold_qty asc, il.name
  limit p_limit
$$;

-- Slow / inactive customers — least business in the window.
create or replace function ask_slow_customers(p_tenant_id uuid, p_days int, p_limit int)
returns table(name text, recent_sales numeric, last_order date, balance numeric)
language sql stable as $$
  select c.name,
         coalesce(sum(so.pkr_equivalent) filter (where so.date >= current_date - p_days), 0) as recent_sales,
         max(so.date) as last_order,
         coalesce((select sum(debit-credit) from tajir_journal_entry_lines jl where jl.tenant_id=p_tenant_id and jl.customer_id=c.id),0)
  from tajir_customers c
  left join sales_orders so on so.customer_id = c.id and so.tenant_id = c.tenant_id
  where c.tenant_id = p_tenant_id
  group by c.id, c.name
  order by recent_sales asc, last_order asc nulls first
  limit p_limit
$$;

-- Top customers — most business in the window.
create or replace function ask_top_customers(p_tenant_id uuid, p_days int, p_limit int)
returns table(name text, recent_sales numeric, order_count bigint, last_order date)
language sql stable as $$
  select c.name,
         coalesce(sum(so.pkr_equivalent) filter (where so.date >= current_date - p_days), 0) as recent_sales,
         count(distinct so.serial_number) filter (where so.date >= current_date - p_days),
         max(so.date)
  from tajir_customers c
  join sales_orders so on so.customer_id = c.id and so.tenant_id = c.tenant_id
  where c.tenant_id = p_tenant_id
  group by c.id, c.name
  having coalesce(sum(so.pkr_equivalent) filter (where so.date >= current_date - p_days), 0) > 0
  order by recent_sales desc
  limit p_limit
$$;

-- Outstanding receivables — customers who owe us, largest first.
create or replace function ask_receivables(p_tenant_id uuid, p_limit int)
returns table(name text, balance numeric)
language sql stable as $$
  select c.name, sum(jl.debit - jl.credit) as balance
  from tajir_customers c
  join tajir_journal_entry_lines jl on jl.customer_id = c.id and jl.tenant_id = c.tenant_id
  where c.tenant_id = p_tenant_id
  group by c.id, c.name
  having sum(jl.debit - jl.credit) > 0.01
  order by balance desc
  limit p_limit
$$;

-- Outstanding payables — suppliers we owe, largest first.
create or replace function ask_payables(p_tenant_id uuid, p_limit int)
returns table(name text, balance numeric)
language sql stable as $$
  select s.name, sum(jl.credit - jl.debit) as balance
  from suppliers s
  join tajir_journal_entry_lines jl on jl.supplier_id = s.id and jl.tenant_id = s.tenant_id
  where s.tenant_id = p_tenant_id
  group by s.id, s.name
  having sum(jl.credit - jl.debit) > 0.01
  order by balance desc
  limit p_limit
$$;

-- Low stock — items with the least quantity on hand.
create or replace function ask_low_stock(p_tenant_id uuid, p_limit int)
returns table(name text, current_quantity numeric, unit_of_measure text)
language sql stable as $$
  select name, current_quantity, unit_of_measure
  from inventory_lots
  where tenant_id = p_tenant_id
  order by current_quantity asc nulls last, name
  limit p_limit
$$;
