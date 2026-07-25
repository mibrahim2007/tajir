-- ── Ask: party name search (ILIKE) ─────────────────────────────────
-- Read-only, tenant-scoped like the other ask_* functions. Returns every
-- customer AND supplier whose name matches the term (case-insensitive, partial —
-- ILIKE '%term%'), each with its current GL balance, so a fragment like "Ali"
-- lists all matching parties instead of the engine guessing one. Balance sign
-- matches ask_receivables/ask_payables: customer = Σ(debit−credit) (positive =
-- owes you), supplier = Σ(credit−debit) (positive = you owe).
create or replace function ask_search_parties(p_tenant_id uuid, p_term text)
returns table(name text, kind text, balance numeric)
language sql stable as $$
  select c.name, 'customer'::text as kind,
         coalesce((select sum(jl.debit - jl.credit)
                     from tajir_journal_entry_lines jl
                    where jl.customer_id = c.id and jl.tenant_id = c.tenant_id), 0) as balance
  from tajir_customers c
  where c.tenant_id = p_tenant_id and c.name ilike '%' || p_term || '%'
  union all
  select s.name, 'supplier'::text,
         coalesce((select sum(jl.credit - jl.debit)
                     from tajir_journal_entry_lines jl
                    where jl.supplier_id = s.id and jl.tenant_id = s.tenant_id), 0)
  from suppliers s
  where s.tenant_id = p_tenant_id and s.name ilike '%' || p_term || '%'
  order by 2, 1
  limit 50
$$;
