create table if not exists accounting_locks (
  tenant_id       uuid primary key references tenants(id) on delete cascade,
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