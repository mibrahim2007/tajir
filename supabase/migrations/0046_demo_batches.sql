-- Demo / playground test-data generator: batch tracking.
--
-- Every row the generator creates is recorded here so the whole batch can be
-- removed cleanly later, in reverse dependency order. Business tables are left
-- untouched (no is_demo columns) — this pair of tables is the only footprint.

create table if not exists public.demo_batches (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  removed_at  timestamptz,
  auto_remove boolean not null default false,
  config      jsonb not null default '{}'::jsonb,   -- the answers the wizard collected
  summary     jsonb not null default '{}'::jsonb    -- per-entity counts actually created
);

create index if not exists idx_demo_batches_tenant on public.demo_batches(tenant_id);

-- One row per created record. `entity` is a coarse type tag used to order the
-- teardown; `row_id` is text because it holds uuids (business rows), invoice_ids,
-- and auth user ids alike.
create table if not exists public.demo_batch_rows (
  id         bigint generated always as identity primary key,
  batch_id   uuid not null references public.demo_batches(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  entity     text not null,
  row_id     text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_demo_batch_rows_batch on public.demo_batch_rows(batch_id);

-- Access is only ever through the service-role admin client inside server
-- actions (which scope by tenant_id). Enable RLS with no policies so the
-- anon/authenticated roles are denied by default, matching every other table.
alter table public.demo_batches   enable row level security;
alter table public.demo_batch_rows enable row level security;
