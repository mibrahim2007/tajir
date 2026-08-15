create table if not exists public.demo_batches (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  removed_at  timestamptz,
  auto_remove boolean not null default false,
  config      jsonb not null default '{}'::jsonb,
  summary     jsonb not null default '{}'::jsonb
);

create index if not exists idx_demo_batches_tenant on public.demo_batches(tenant_id);

create table if not exists public.demo_batch_rows (
  id         bigint generated always as identity primary key,
  batch_id   uuid not null references public.demo_batches(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  entity     text not null,
  row_id     text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_demo_batch_rows_batch on public.demo_batch_rows(batch_id);

alter table public.demo_batches   enable row level security;
alter table public.demo_batch_rows enable row level security;