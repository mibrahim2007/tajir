alter table profit_allocations
  add column if not exists status text not null default 'active'
    check (status in ('active', 'reversed')),
  add column if not exists reversed_at timestamptz;

create index if not exists profit_allocations_active_period_idx
  on profit_allocations(tenant_id, status, period_start, period_end);