-- Custom financial report builder.
--
-- Lets a tenant define its own statement layout: the reporting headers it wants
-- to see, which GL account codes roll into each one, and how each line BEHAVES
-- (sign convention, whether child accounts roll up, whether the individual
-- accounts are listed, indentation, subtotal formulas).
--
-- Nothing here stores amounts. A definition is a layout only; every figure is
-- computed at view time from the journal via lib/reports/ledger-totals, so a
-- custom report can never drift from the P&L / Balance Sheet / Trial Balance.

create table if not exists public.custom_reports (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  description text,
  -- 'period' = movement between two dates (P&L style).
  -- 'as_of'  = cumulative balance up to one date (Balance Sheet style).
  basis       text not null default 'period' check (basis in ('period', 'as_of')),
  -- Suppress lines whose computed amount is exactly zero.
  hide_zero_rows boolean not null default true,
  is_active   boolean not null default true,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_custom_reports_tenant on public.custom_reports(tenant_id);
create unique index if not exists uq_custom_reports_tenant_name
  on public.custom_reports(tenant_id, lower(name));

-- One row per printed line of the report, in `sort_order`.
--
--   header   → a bold caption, no amount (e.g. "REVENUE")
--   accounts → a reporting header that sums the account codes mapped to it
--   subtotal → computed from `formula`, an expression over other lines' `ref`
--   spacer   → blank line, used for visual grouping
create table if not exists public.custom_report_lines (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.custom_reports(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  sort_order integer not null default 0,
  line_type  text not null check (line_type in ('header', 'accounts', 'subtotal', 'spacer')),
  label      text not null default '',
  -- Short handle (e.g. "REV") so subtotal formulas can name this line.
  ref        text,
  indent     integer not null default 0 check (indent between 0 and 4),
  -- Sign behaviour. The GL net is debit - credit.
  --   natural         → show the net as-is; debit balances print positive
  --   credit_positive → flip the sign, so credit balances print positive
  --                     (what revenue, liability and equity headers want)
  sign       text not null default 'natural' check (sign in ('natural', 'credit_positive')),
  -- Roll descendant accounts of each mapped code into the line.
  include_children boolean not null default true,
  -- List every contributing account beneath the header line.
  show_detail boolean not null default false,
  is_bold    boolean not null default false,
  -- Draw a rule above the amount (accounting-style total).
  underline  boolean not null default false,
  -- Only for line_type = 'subtotal'. Refs joined by + / -, e.g. "REV - COGS".
  formula    text,
  created_at timestamptz not null default now()
);

create index if not exists idx_custom_report_lines_report on public.custom_report_lines(report_id, sort_order);
create unique index if not exists uq_custom_report_lines_ref
  on public.custom_report_lines(report_id, upper(ref)) where ref is not null and ref <> '';

-- The account codes mapped to an 'accounts' line. Stored by code (unique per
-- tenant and stable in the UI) rather than by id, so a re-seeded chart of
-- accounts does not silently empty every saved report.
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

-- Access is only ever through the service-role admin client inside server
-- actions (which scope by tenant_id). Enable RLS with no policies so the
-- anon/authenticated roles are denied by default, matching every other table.
alter table public.custom_reports             enable row level security;
alter table public.custom_report_lines        enable row level security;
alter table public.custom_report_line_accounts enable row level security;
