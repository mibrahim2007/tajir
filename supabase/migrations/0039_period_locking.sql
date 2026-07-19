-- ── Period locking ──────────────────────────────────────────────────
-- "Books locked through <date>": once a period is closed, nothing may post
-- into it, be edited within it, or be deleted out of it.
--
-- A single lock-through date per tenant (the model used by QuickBooks' closing
-- date and Xero's lock dates) rather than arbitrary lockable ranges: closing
-- the books is always "everything up to and including <date> is final", and
-- leaving a hole open in the middle of closed history has no accounting meaning.
--
-- ENFORCEMENT IS IN THE DATABASE, deliberately. The Next.js server actions are
-- not the only writer — the mobile quick-sale / quick-purchase edge functions
-- post journal entries directly (supabase/functions/_shared/gl.ts), and the
-- service-role key bypasses RLS. A trigger is the only place that catches every
-- writer, including future ones. The app also checks before writing, but purely
-- so the user gets a readable message instead of a raw Postgres error.

create table if not exists accounting_locks (
  tenant_id       uuid primary key references tenants(id) on delete cascade,
  -- Everything dated on or before this is final. NULL row = nothing locked.
  locked_through  date not null,
  note            text,
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);

alter table accounting_locks enable row level security;

create policy "accounting_locks: tenant select" on accounting_locks for select
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "accounting_locks: tenant insert" on accounting_locks for insert
  with check (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "accounting_locks: tenant update" on accounting_locks for update
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "accounting_locks: tenant delete" on accounting_locks for delete
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);

-- ── Guard on the journal entry header ───────────────────────────────
-- The message is prefixed PERIOD_LOCKED so the application can recognise it and
-- present it properly rather than leaking a database error.
create or replace function enforce_period_lock() returns trigger
language plpgsql
as $$
declare
  v_locked date;
  v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  select locked_through into v_locked from accounting_locks where tenant_id = v_tenant;
  if v_locked is null then
    return coalesce(new, old);
  end if;

  -- An UPDATE is checked on BOTH dates: moving an entry out of a locked period
  -- is just as much a change to closed books as moving one in.
  if tg_op in ('INSERT', 'UPDATE') and new.date <= v_locked then
    raise exception 'PERIOD_LOCKED: the books are locked through %, so nothing dated on or before that can be posted or changed (entry dated %)', v_locked, new.date;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.date <= v_locked then
    raise exception 'PERIOD_LOCKED: the books are locked through %, so nothing dated on or before that can be changed or removed (entry dated %)', v_locked, old.date;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enforce_period_lock on tajir_journal_entries;
create trigger trg_enforce_period_lock
  before insert or update or delete on tajir_journal_entries
  for each row execute function enforce_period_lock();

-- ── Guard on the journal entry LINES ────────────────────────────────
-- Without this, the header trigger could be sidestepped by rewriting the lines
-- of a locked entry and leaving the header untouched.
create or replace function enforce_period_lock_lines() returns trigger
language plpgsql
as $$
declare
  v_locked date;
  v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
  v_date   date;
begin
  select locked_through into v_locked from accounting_locks where tenant_id = v_tenant;
  if v_locked is null then
    return coalesce(new, old);
  end if;

  select date into v_date from tajir_journal_entries
   where id = coalesce(new.journal_entry_id, old.journal_entry_id);

  -- A cascade from a permitted header delete leaves no parent to find; the
  -- header trigger has already vetted that case.
  if v_date is not null and v_date <= v_locked then
    raise exception 'PERIOD_LOCKED: the books are locked through %, so the lines of an entry dated % cannot be changed', v_locked, v_date;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enforce_period_lock_lines on tajir_journal_entry_lines;
create trigger trg_enforce_period_lock_lines
  before insert or update or delete on tajir_journal_entry_lines
  for each row execute function enforce_period_lock_lines();
