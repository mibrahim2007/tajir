-- ── Posting Accounts: atomic save + change history ──────────────────────
-- Every change to posting_account_overrides is recorded, tenant-wise, in
-- posting_account_override_history: what was added, changed or removed, the
-- account before and after (id AND a name snapshot, so the history still reads
-- correctly after an account is renamed or deleted), who did it and when.
--
-- The history is written by a trigger, so it catches every path — including an
-- override that disappears because its account was deleted (ON DELETE CASCADE),
-- which is logged with no user and the reason "account deleted".
--
-- Saving goes through save_posting_account_overrides(), one transaction: it
-- diffs the submitted set against what is stored and only inserts / updates /
-- deletes the rows that actually changed, so an unchanged head leaves no noise
-- in the history. All rows from one save share a batch_id.

create table if not exists public.posting_account_override_history (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  batch_id           uuid,
  action             text not null check (action in ('insert', 'update', 'delete')),
  process            text not null,
  system_key         text not null,
  old_account_id     uuid,
  old_account_label  text,
  new_account_id     uuid,
  new_account_label  text,
  changed_by         uuid,
  changed_by_label   text,
  reason             text,
  changed_at         timestamptz not null default now()
);

create index if not exists posting_account_override_history_tenant_idx
  on public.posting_account_override_history (tenant_id, changed_at desc);

alter table public.posting_account_override_history enable row level security;
drop policy if exists "posting_account_override_history: tenant select" on public.posting_account_override_history;
create policy "posting_account_override_history: tenant select" on public.posting_account_override_history for select
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);

-- "1130 · Accounts Receivable". When the account no longer exists (an override
-- cascading away with its deleted account), fall back to the name the history
-- last recorded for it.
create or replace function public.posting_account_label(p_account_id uuid)
returns text language sql stable as $$
  select coalesce(
    (select code || ' · ' || name from public.chart_of_accounts where id = p_account_id),
    (select new_account_label from public.posting_account_override_history
      where new_account_id = p_account_id and new_account_label is not null
      order by changed_at desc limit 1)
  )
$$;

create or replace function public.log_posting_account_override()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_batch  uuid := nullif(current_setting('tajir.posting_batch', true), '')::uuid;
  v_user   uuid := nullif(current_setting('tajir.posting_user', true), '')::uuid;
  v_label  text := nullif(current_setting('tajir.posting_user_label', true), '');
begin
  if tg_op = 'INSERT' then
    insert into posting_account_override_history
      (tenant_id, batch_id, action, process, system_key, new_account_id, new_account_label, changed_by, changed_by_label)
    values
      (new.tenant_id, v_batch, 'insert', new.process, new.system_key, new.account_id, posting_account_label(new.account_id), v_user, v_label);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.account_id is distinct from old.account_id then
      insert into posting_account_override_history
        (tenant_id, batch_id, action, process, system_key, old_account_id, old_account_label, new_account_id, new_account_label, changed_by, changed_by_label)
      values
        (new.tenant_id, v_batch, 'update', new.process, new.system_key, old.account_id, posting_account_label(old.account_id),
         new.account_id, posting_account_label(new.account_id), v_user, v_label);
    end if;
    return new;
  else
    -- No batch means this delete did not come from a save: the account it
    -- pointed at was deleted and the override cascaded away with it. Skip it
    -- when the whole tenant is being removed — the history goes with it.
    if v_batch is null and not exists (select 1 from tenants where id = old.tenant_id) then
      return old;
    end if;
    insert into posting_account_override_history
      (tenant_id, batch_id, action, process, system_key, old_account_id, old_account_label, changed_by, changed_by_label, reason)
    values
      (old.tenant_id, v_batch, 'delete', old.process, old.system_key, old.account_id, posting_account_label(old.account_id),
       v_user, v_label, case when v_batch is null then 'account deleted' end);
    return old;
  end if;
end $$;

drop trigger if exists posting_account_overrides_history on public.posting_account_overrides;
create trigger posting_account_overrides_history
  after insert or update or delete on public.posting_account_overrides
  for each row execute function public.log_posting_account_override();

-- Replace the tenant's overrides with p_rows ([{process, system_key, account_id}])
-- in one transaction. Validation (allowed pairs, account type) is done by the
-- server action before calling this; the function only applies the diff.
create or replace function public.save_posting_account_overrides(
  p_tenant_id  uuid,
  p_user_id    uuid,
  p_user_label text,
  p_rows       jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_batch    uuid := gen_random_uuid();
  v_inserted int;
  v_updated  int;
  v_deleted  int;
begin
  perform set_config('tajir.posting_batch', v_batch::text, true);
  perform set_config('tajir.posting_user', coalesce(p_user_id::text, ''), true);
  perform set_config('tajir.posting_user_label', coalesce(p_user_label, ''), true);

  drop table if exists _wanted;
  create temp table _wanted on commit drop as
    select r->>'process' as process, r->>'system_key' as system_key, (r->>'account_id')::uuid as account_id
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;

  delete from posting_account_overrides o
  where o.tenant_id = p_tenant_id
    and not exists (select 1 from _wanted w where w.process = o.process and w.system_key = o.system_key);
  get diagnostics v_deleted = row_count;

  update posting_account_overrides o
  set account_id = w.account_id, updated_at = now(), updated_by = p_user_id
  from _wanted w
  where o.tenant_id = p_tenant_id and o.process = w.process and o.system_key = w.system_key
    and o.account_id is distinct from w.account_id;
  get diagnostics v_updated = row_count;

  insert into posting_account_overrides (tenant_id, process, system_key, account_id, updated_by)
  select p_tenant_id, w.process, w.system_key, w.account_id, p_user_id
  from _wanted w
  where not exists (
    select 1 from posting_account_overrides o
    where o.tenant_id = p_tenant_id and o.process = w.process and o.system_key = w.system_key
  );
  get diagnostics v_inserted = row_count;

  return jsonb_build_object('batch_id', v_batch, 'inserted', v_inserted, 'updated', v_updated, 'deleted', v_deleted);
end $$;

-- Server-side only: it takes the tenant as a parameter, so a signed-in user
-- must never be able to call it directly.
revoke all on function public.save_posting_account_overrides(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_posting_account_overrides(uuid, uuid, text, jsonb) to service_role;
revoke all on function public.log_posting_account_override() from public, anon, authenticated;
