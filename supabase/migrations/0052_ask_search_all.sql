-- ── Ask: search everything by name (ILIKE) ─────────────────────────
-- ask_search_parties (0050) only looked at customers and suppliers, so a
-- fragment like "card" found nothing to disambiguate and the engine fell
-- through to fuzzy matching, which silently picked ONE item and showed its
-- stock ledger. On a live tenant "card" should list both "10 GB CARD" and
-- "5 GB CARD"; instead it showed one of them with no hint the other existed.
--
-- This widens the search to everything a user refers to by name — customers,
-- suppliers, stock items (by name, code or SKU) and employees — so a fragment
-- behaves like the LIKE search people expect.
--
-- Read-only and tenant-scoped like every other ask_* function. Balance signs
-- match ask_receivables/ask_payables: customer = Σ(debit−credit) (positive =
-- owes you), supplier = Σ(credit−debit) (positive = you owe).
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

  -- Code and SKU are matched too: people search stock by the number printed
  -- on the packet as often as by its name.
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
