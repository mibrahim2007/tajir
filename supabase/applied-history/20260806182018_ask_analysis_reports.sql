create or replace function ask_monthly_sales(p_tenant_id uuid, p_months int default 12)
returns table(month text, orders bigint, qty numeric, value numeric)
language sql stable as $$
  select to_char(date_trunc('month', so.date), 'YYYY-MM') as month,
         count(*) as orders,
         coalesce(sum(so.quantity), 0) as qty,
         coalesce(sum(so.pkr_equivalent), 0) as value
  from sales_orders so
  where so.tenant_id = p_tenant_id
    and so.date >= date_trunc('month', current_date) - ((p_months - 1) || ' months')::interval
  group by 1
  order by 1
$$;

create or replace function ask_monthly_purchases(p_tenant_id uuid, p_months int default 12)
returns table(month text, orders bigint, qty numeric, value numeric)
language sql stable as $$
  select to_char(date_trunc('month', po.date), 'YYYY-MM') as month,
         count(*) as orders,
         coalesce(sum(po.quantity), 0) as qty,
         coalesce(sum(po.pkr_equivalent), 0) as value
  from purchase_orders po
  where po.tenant_id = p_tenant_id
    and po.date >= date_trunc('month', current_date) - ((p_months - 1) || ' months')::interval
  group by 1
  order by 1
$$;

create or replace function ask_expense_breakdown(p_tenant_id uuid, p_months int default 12)
returns table(account text, code text, total numeric, entries bigint)
language sql stable as $$
  select a.name as account,
         a.code::text as code,
         coalesce(sum(jl.debit - jl.credit), 0) as total,
         count(*) as entries
  from tajir_journal_entry_lines jl
  join chart_of_accounts a on a.id = jl.account_id
  join tajir_journal_entries je on je.id = jl.journal_entry_id
  where jl.tenant_id = p_tenant_id
    and a.account_type = 'expense'
    and je.date >= date_trunc('month', current_date) - ((p_months - 1) || ' months')::interval
  group by a.name, a.code
  having coalesce(sum(jl.debit - jl.credit), 0) <> 0
  order by 3 desc
$$;

create or replace function ask_monthly_expenses(p_tenant_id uuid, p_months int default 12)
returns table(month text, total numeric, entries bigint)
language sql stable as $$
  select to_char(date_trunc('month', je.date), 'YYYY-MM') as month,
         coalesce(sum(jl.debit - jl.credit), 0) as total,
         count(*) as entries
  from tajir_journal_entry_lines jl
  join chart_of_accounts a on a.id = jl.account_id
  join tajir_journal_entries je on je.id = jl.journal_entry_id
  where jl.tenant_id = p_tenant_id
    and a.account_type = 'expense'
    and je.date >= date_trunc('month', current_date) - ((p_months - 1) || ' months')::interval
  group by 1
  order by 1
$$;

create or replace function ask_item_monthly(p_tenant_id uuid, p_item_id uuid, p_months int default 12)
returns table(month text, sold_qty numeric, sold_value numeric, bought_qty numeric, bought_value numeric)
language sql stable as $$
  with months as (
    select to_char(generate_series(
      date_trunc('month', current_date) - ((p_months - 1) || ' months')::interval,
      date_trunc('month', current_date),
      '1 month'::interval), 'YYYY-MM') as month
  ),
  sold as (
    select to_char(date_trunc('month', so.date), 'YYYY-MM') as month,
           sum(so.quantity) as qty, sum(so.pkr_equivalent) as value
    from sales_orders so
    where so.tenant_id = p_tenant_id and so.stock_item_id = p_item_id
    group by 1
  ),
  bought as (
    select to_char(date_trunc('month', po.date), 'YYYY-MM') as month,
           sum(po.quantity) as qty, sum(po.pkr_equivalent) as value
    from purchase_orders po
    where po.tenant_id = p_tenant_id and po.stock_item_id = p_item_id
    group by 1
  )
  select m.month,
         coalesce(s.qty, 0), coalesce(s.value, 0),
         coalesce(b.qty, 0), coalesce(b.value, 0)
  from months m
  left join sold s   on s.month = m.month
  left join bought b on b.month = m.month
  order by m.month
$$;

create or replace function ask_customer_grades(p_tenant_id uuid, p_months int default 12)
returns table(name text, orders bigint, qty numeric, value numeric, share numeric, cumulative numeric, grade text)
language sql stable as $$
  with sales as (
    select c.name,
           count(*) as orders,
           coalesce(sum(so.quantity), 0) as qty,
           coalesce(sum(so.pkr_equivalent), 0) as value
    from sales_orders so
    join tajir_customers c on c.id = so.customer_id
    where so.tenant_id = p_tenant_id
      and so.date >= date_trunc('month', current_date) - ((p_months - 1) || ' months')::interval
    group by c.name
    having coalesce(sum(so.pkr_equivalent), 0) > 0
  ),
  total as (select nullif(sum(value), 0) as t from sales),
  ranked as (
    select s.*,
           round(100 * s.value / (select t from total), 2) as share,
           round(100 * sum(s.value) over (order by s.value desc, s.name)
                 / (select t from total), 2) as cumulative
    from sales s
  )
  select r.name, r.orders, r.qty, r.value, r.share, r.cumulative,
         case when r.cumulative <= 80 then 'A'
              when r.cumulative <= 95 then 'B'
              else 'C' end as grade
  from ranked r
  order by r.value desc
$$;

create or replace function ask_supplier_grades(p_tenant_id uuid, p_months int default 12)
returns table(name text, orders bigint, value numeric, share numeric, cumulative numeric,
              returned numeric, return_rate numeric, grade text)
language sql stable as $$
  with buys as (
    select s.id, s.name,
           count(*) as orders,
           coalesce(sum(po.pkr_equivalent), 0) as value
    from purchase_orders po
    join suppliers s on s.id = po.supplier_id
    where po.tenant_id = p_tenant_id
      and po.date >= date_trunc('month', current_date) - ((p_months - 1) || ' months')::interval
    group by s.id, s.name
    having coalesce(sum(po.pkr_equivalent), 0) > 0
  ),
  rets as (
    select pr.supplier_id, coalesce(sum(pr.pkr_equivalent), 0) as returned
    from purchase_returns pr
    where pr.tenant_id = p_tenant_id
      and pr.date >= date_trunc('month', current_date) - ((p_months - 1) || ' months')::interval
    group by pr.supplier_id
  ),
  total as (select nullif(sum(value), 0) as t from buys),
  ranked as (
    select b.*, coalesce(r.returned, 0) as returned,
           round(100 * b.value / (select t from total), 2) as share,
           round(100 * sum(b.value) over (order by b.value desc, b.name)
                 / (select t from total), 2) as cumulative
    from buys b
    left join rets r on r.supplier_id = b.id
  )
  select r.name, r.orders, r.value, r.share, r.cumulative, r.returned,
         round(100 * r.returned / nullif(r.value, 0), 2) as return_rate,
         case
           when round(100 * r.returned / nullif(r.value, 0), 2) >= 10 then 'C'
           when r.cumulative <= 80 then 'A'
           when r.cumulative <= 95 then 'B'
           else 'C'
         end as grade
  from ranked r
  order by r.value desc
$$;