-- ── Ask: cheque (PDC) analytics functions ──────────────────────────
-- Read the pdc_register view (which already unions all seven tender-line
-- sources) so the Ask page can report cheque detail and status. Read-only,
-- tenant-scoped like the rest of migration 0044. Endorsed-out lines are
-- already hidden by the view, so a handed-on cheque shows once, as the source.

-- List cheques with optional status / direction / overdue filters. NULL filter
-- means "any". Overdue = still pending and past its due date.
create or replace function ask_cheques(
  p_tenant_id uuid, p_status text, p_direction text, p_overdue boolean, p_limit int
)
returns table(cheque_number text, party_name text, direction text, doc_serial text,
              cheque_due_date date, amount numeric, pdc_status text, source text)
language sql stable as $$
  select r.cheque_number, r.party_name, r.direction, r.doc_serial,
         r.cheque_due_date, r.amount, r.pdc_status, r.source
  from pdc_register r
  where r.tenant_id = p_tenant_id
    and (p_status is null or r.pdc_status = p_status)
    and (p_direction is null or r.direction = p_direction)
    and (not p_overdue or (r.pdc_status = 'pending'
                           and r.cheque_due_date is not null
                           and r.cheque_due_date < current_date))
  order by (r.pdc_status = 'pending') desc, r.cheque_due_date asc nulls last, r.amount desc
  limit p_limit
$$;

-- Counts and totals grouped by direction and status — the cheque overview.
create or replace function ask_cheque_summary(p_tenant_id uuid)
returns table(direction text, pdc_status text, n bigint, total numeric)
language sql stable as $$
  select r.direction, r.pdc_status, count(*), sum(r.amount)
  from pdc_register r
  where r.tenant_id = p_tenant_id
  group by r.direction, r.pdc_status
  order by r.direction, r.pdc_status
$$;

-- Find a specific cheque by (part of) its number, with its current status.
create or replace function ask_cheque_by_number(p_tenant_id uuid, p_number text)
returns table(cheque_number text, party_name text, direction text, doc_serial text,
              cheque_due_date date, amount numeric, pdc_status text, source text)
language sql stable as $$
  select r.cheque_number, r.party_name, r.direction, r.doc_serial,
         r.cheque_due_date, r.amount, r.pdc_status, r.source
  from pdc_register r
  where r.tenant_id = p_tenant_id
    and r.cheque_number ilike '%' || p_number || '%'
  order by r.cheque_due_date asc nulls last
  limit 50
$$;
