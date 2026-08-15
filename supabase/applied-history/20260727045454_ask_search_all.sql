create or replace function ask_search_all(p_tenant_id uuid, p_term text)
returns table(kind text, name text, detail text, value numeric, value_kind text)
language sql stable as $$
  select 'customer'::text as kind, c.name, ''::text as detail,
         coalesce((select sum(jl.debit - jl.credit)
                     from tajir_journal_entry_lines jl
                    where jl.customer_id = c.id and jl.tenant_id = c.tenant_id), 0) as value,
         'money'::text as value_kind
    from tajir_customers c
   where c.tenant_id = p_tenant_id and c.name ilike '%' || p_term || '%'

  union all
  select 'supplier', s.name, '',
         coalesce((select sum(jl.credit - jl.debit)
                     from tajir_journal_entry_lines jl
                    where jl.supplier_id = s.id and jl.tenant_id = s.tenant_id), 0),
         'money'
    from suppliers s
   where s.tenant_id = p_tenant_id and s.name ilike '%' || p_term || '%'

  union all
  select 'item', l.name,
         coalesce(nullif(l.code, ''), nullif(l.sku, ''), ''),
         coalesce(l.current_quantity, 0),
         'qty'
    from inventory_lots l
   where l.tenant_id = p_tenant_id
     and (l.name ilike '%' || p_term || '%'
       or coalesce(l.code, '') ilike '%' || p_term || '%'
       or coalesce(l.sku, '')  ilike '%' || p_term || '%')

  union all
  select 'employee', e.name, '', null::numeric, null::text
    from employees e
   where e.tenant_id = p_tenant_id and e.name ilike '%' || p_term || '%'

  order by 1, 2
  limit 60
$$;