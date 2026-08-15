create table if not exists public.custom_reports (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  description text,
  basis       text not null default 'period' check (basis in ('period', 'as_of')),
  hide_zero_rows boolean not null default true,
  is_active   boolean not null default true,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_custom_reports_tenant on public.custom_reports(tenant_id);
create unique index if not exists uq_custom_reports_tenant_name
  on public.custom_reports(tenant_id, lower(name));

create table if not exists public.custom_report_lines (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.custom_reports(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  sort_order integer not null default 0,
  line_type  text not null check (line_type in ('header', 'accounts', 'subtotal', 'spacer')),
  label      text not null default '',
  ref        text,
  indent     integer not null default 0 check (indent between 0 and 4),
  sign       text not null default 'natural' check (sign in ('natural', 'credit_positive')),
  include_children boolean not null default true,
  show_detail boolean not null default false,
  is_bold    boolean not null default false,
  underline  boolean not null default false,
  formula    text,
  created_at timestamptz not null default now()
);

create index if not exists idx_custom_report_lines_report on public.custom_report_lines(report_id, sort_order);
create unique index if not exists uq_custom_report_lines_ref
  on public.custom_report_lines(report_id, upper(ref)) where ref is not null and ref <> '';

create table if not exists public.custom_report_line_accounts (
  id           uuid primary key default gen_random_uuid(),
  line_id      uuid not null references public.custom_report_lines(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  account_code varchar(10) not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_custom_report_line_accounts_line on public.custom_report_line_accounts(line_id);
create unique index if not exists uq_custom_report_line_accounts
  on public.custom_report_line_accounts(line_id, account_code);

alter table public.custom_reports              enable row level security;
alter table public.custom_report_lines         enable row level security;
alter table public.custom_report_line_accounts enable row level security;