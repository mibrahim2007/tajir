-- ── Close the open PostgREST tables ─────────────────────────────────
-- Seven tables in `public` were exposed through PostgREST with RLS switched
-- OFF entirely. Verified against production: an UNAUTHENTICATED request
-- carrying only the publishable key — the key that ships inside the browser
-- bundle — returned rows from supplier_refunds, support_tickets,
-- ticket_messages, gatepass_items, item_types and party_links, across every
-- tenant. tajir_attachments was equally open and simply had no rows yet.
--
-- Enabling RLS is safe here. Every one of the 232 files that touch data uses
-- the service-role admin client, which bypasses RLS by design, and scopes its
-- own reads with an explicit `.eq('tenant_id', …)`. The browser and user-JWT
-- clients are used only for sign-in. So RLS on these tables is defence in
-- depth that was simply never switched on — turning it on closes the hole
-- without changing a single application read.
--
-- Policies use the same JWT expression as every other table in this schema.

-- ── 1. Tables that carry tenant_id directly ─────────────────────────
alter table tajir_attachments enable row level security;
alter table item_types        enable row level security;
alter table party_links       enable row level security;
alter table supplier_refunds  enable row level security;
alter table support_tickets   enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'tajir_attachments','item_types','party_links','supplier_refunds','support_tickets'
  ] loop
    -- Idempotent: drop first so re-running cannot fail on a duplicate name.
    execute format('drop policy if exists "%1$s: tenant select" on %1$s', tbl);
    execute format('drop policy if exists "%1$s: tenant insert" on %1$s', tbl);
    execute format('drop policy if exists "%1$s: tenant update" on %1$s', tbl);
    execute format('drop policy if exists "%1$s: tenant delete" on %1$s', tbl);

    execute format($f$
      create policy "%1$s: tenant select" on %1$s for select
        using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
      create policy "%1$s: tenant insert" on %1$s for insert
        with check (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
      create policy "%1$s: tenant update" on %1$s for update
        using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
      create policy "%1$s: tenant delete" on %1$s for delete
        using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
    $f$, tbl);
  end loop;
end $$;

-- ── 2. Child tables — tenancy comes from the parent ─────────────────
-- gatepass_items has no tenant_id of its own; it belongs to a gatepass.
alter table gatepass_items enable row level security;

drop policy if exists "gatepass_items: tenant select" on gatepass_items;
drop policy if exists "gatepass_items: tenant insert" on gatepass_items;
drop policy if exists "gatepass_items: tenant update" on gatepass_items;
drop policy if exists "gatepass_items: tenant delete" on gatepass_items;

create policy "gatepass_items: tenant select" on gatepass_items for select
  using (exists (
    select 1 from gatepasses g
     where g.id = gatepass_items.gatepass_id
       and g.tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid));
create policy "gatepass_items: tenant insert" on gatepass_items for insert
  with check (exists (
    select 1 from gatepasses g
     where g.id = gatepass_items.gatepass_id
       and g.tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid));
create policy "gatepass_items: tenant update" on gatepass_items for update
  using (exists (
    select 1 from gatepasses g
     where g.id = gatepass_items.gatepass_id
       and g.tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid));
create policy "gatepass_items: tenant delete" on gatepass_items for delete
  using (exists (
    select 1 from gatepasses g
     where g.id = gatepass_items.gatepass_id
       and g.tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid));

-- ticket_messages belongs to a support_ticket. This one matters most of the
-- seven: it is free-text correspondence between a tenant and support.
alter table ticket_messages enable row level security;

drop policy if exists "ticket_messages: tenant select" on ticket_messages;
drop policy if exists "ticket_messages: tenant insert" on ticket_messages;
drop policy if exists "ticket_messages: tenant update" on ticket_messages;
drop policy if exists "ticket_messages: tenant delete" on ticket_messages;

create policy "ticket_messages: tenant select" on ticket_messages for select
  using (exists (
    select 1 from support_tickets t
     where t.id = ticket_messages.ticket_id
       and t.tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid));
create policy "ticket_messages: tenant insert" on ticket_messages for insert
  with check (exists (
    select 1 from support_tickets t
     where t.id = ticket_messages.ticket_id
       and t.tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid));
create policy "ticket_messages: tenant update" on ticket_messages for update
  using (exists (
    select 1 from support_tickets t
     where t.id = ticket_messages.ticket_id
       and t.tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid));
create policy "ticket_messages: tenant delete" on ticket_messages for delete
  using (exists (
    select 1 from support_tickets t
     where t.id = ticket_messages.ticket_id
       and t.tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid));

-- ── 3. Stop signed-in users rewriting anyone's stock ────────────────
-- `adjust_inventory_quantity` is SECURITY DEFINER and was callable by any
-- signed-in user via /rest/v1/rpc/adjust_inventory_quantity — with a lot id
-- and a delta, that is arbitrary stock manipulation in ANY tenant, since the
-- function takes no tenant argument to check. Only server code calls it, and
-- server code holds the service role, so nothing legitimate loses access.
revoke execute on function public.adjust_inventory_quantity(uuid, numeric) from anon, authenticated;

-- ── 4. Views must not launder past RLS ──────────────────────────────
-- A SECURITY DEFINER view runs with its creator's rights, so reading it
-- sidesteps the caller's policies entirely. `security_invoker` makes them
-- honour the querying role instead. The app reads these through the service
-- role, which is unaffected.
alter view public.pdc_register            set (security_invoker = on);
alter view public.location_stock_summary  set (security_invoker = on);

-- ── 5. Pin search_path on every public function ─────────────────────
-- A mutable search_path lets a caller who can create objects shadow a table
-- or operator the function relies on. Applied across the board rather than
-- one at a time, so functions added later by hand are caught by re-running.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, '{}')) cfg
          where cfg like 'search_path=%')
       -- Skip functions owned by an extension (pg_trgm installs set_limit and
       -- friends into public). We are not their owner, so ALTER would fail and
       -- take the whole migration down with it.
       and not exists (
         select 1 from pg_depend d
          where d.objid = p.oid and d.classid = 'pg_proc'::regclass and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, pg_temp', fn.sig);
  end loop;
end $$;
