-- =============================================================================
-- LedgerPro Initial Schema v1.0
-- Double-entry accounting SaaS with RLS multi-tenancy
-- =============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- =============================================================================
-- ENUMS
-- =============================================================================

create type plan_tier as enum ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');
create type account_type as enum ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
create type entry_status as enum ('DRAFT', 'PENDING_APPROVAL', 'POSTED', 'VOID');
create type user_role as enum ('OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER', 'AUDITOR');
create type subscription_status as enum ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'DELETED');

-- =============================================================================
-- TABLES (all created before any RLS policies that cross-reference tables)
-- =============================================================================

create table organizations (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  owner_id            uuid not null references auth.users(id),
  plan                plan_tier not null default 'FREE',
  fiscal_year_start   int not null default 1 check (fiscal_year_start between 1 and 12),
  currency            text not null default 'USD',
  timezone            text not null default 'UTC',
  logo_url            text,
  industry            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table org_members (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id),
  role        user_role not null default 'VIEWER',
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique(org_id, user_id)
);

create table accounts (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  code        text not null,
  name        text not null,
  type        account_type not null,
  parent_id   uuid references accounts(id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(org_id, code)
);

create index accounts_org_id_idx on accounts(org_id);
create index accounts_type_idx on accounts(org_id, type);

create table journal_entries (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  date        date not null,
  reference   text,
  description text not null,
  status      entry_status not null default 'DRAFT',
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index journal_entries_org_idx on journal_entries(org_id, date desc);
create index journal_entries_status_idx on journal_entries(org_id, status);
create index journal_entries_fts_idx on journal_entries using gin(to_tsvector('english', description));

create table entry_lines (
  id          uuid primary key default uuid_generate_v4(),
  entry_id    uuid not null references journal_entries(id) on delete cascade,
  account_id  uuid not null references accounts(id),
  debit       numeric(19, 4) not null default 0 check (debit >= 0),
  credit      numeric(19, 4) not null default 0 check (credit >= 0),
  memo        text,
  check (debit = 0 or credit = 0)
);

create index entry_lines_entry_idx on entry_lines(entry_id);
create index entry_lines_account_idx on entry_lines(account_id);

create table audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id),
  action      text not null,
  table_name  text not null,
  record_id   uuid not null,
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index audit_logs_org_idx on audit_logs(org_id, created_at desc);

create table subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null unique references organizations(id) on delete cascade,
  stripe_sub_id       text,
  stripe_customer_id  text,
  plan                plan_tier not null default 'FREE',
  status              subscription_status not null default 'TRIAL',
  current_period_end  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table attachments (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references organizations(id) on delete cascade,
  entry_id     uuid not null references journal_entries(id) on delete cascade,
  storage_path text not null,
  filename     text not null,
  size         int not null,
  created_at   timestamptz not null default now()
);

create table admin_users (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null unique references auth.users(id),
  created_at timestamptz not null default now()
);

-- =============================================================================
-- RLS POLICIES (after all tables exist)
-- =============================================================================

alter table organizations enable row level security;

create policy "Users can view their orgs" on organizations
  for select using (
    exists (
      select 1 from org_members
      where org_members.org_id = organizations.id
      and org_members.user_id = auth.uid()
    )
  );

create policy "Owners can update their org" on organizations
  for update using (owner_id = auth.uid());

alter table org_members enable row level security;

create policy "Members can view their org members" on org_members
  for select using (
    exists (
      select 1 from org_members om2
      where om2.org_id = org_members.org_id
      and om2.user_id = auth.uid()
    )
  );

create policy "Admins can manage members" on org_members
  for all using (
    exists (
      select 1 from org_members om2
      where om2.org_id = org_members.org_id
      and om2.user_id = auth.uid()
      and om2.role in ('OWNER', 'ADMIN')
    )
  );

alter table accounts enable row level security;

create policy "Org members can view accounts" on accounts
  for select using (
    exists (select 1 from org_members where org_id = accounts.org_id and user_id = auth.uid())
  );

create policy "Accountants+ can manage accounts" on accounts
  for all using (
    exists (
      select 1 from org_members
      where org_id = accounts.org_id
      and user_id = auth.uid()
      and role in ('OWNER', 'ADMIN', 'ACCOUNTANT')
    )
  );

alter table journal_entries enable row level security;

create policy "Org members can view entries" on journal_entries
  for select using (
    exists (select 1 from org_members where org_id = journal_entries.org_id and user_id = auth.uid())
  );

create policy "Accountants+ can create entries" on journal_entries
  for insert with check (
    exists (
      select 1 from org_members
      where org_id = journal_entries.org_id
      and user_id = auth.uid()
      and role in ('OWNER', 'ADMIN', 'ACCOUNTANT')
    )
  );

create policy "Accountants+ can update draft entries" on journal_entries
  for update using (
    status = 'DRAFT' and
    exists (
      select 1 from org_members
      where org_id = journal_entries.org_id
      and user_id = auth.uid()
      and role in ('OWNER', 'ADMIN', 'ACCOUNTANT')
    )
  );

alter table entry_lines enable row level security;

create policy "Members can view entry lines" on entry_lines
  for select using (
    exists (
      select 1 from journal_entries je
      join org_members om on om.org_id = je.org_id
      where je.id = entry_lines.entry_id
      and om.user_id = auth.uid()
    )
  );

create policy "Accountants+ can manage entry lines" on entry_lines
  for all using (
    exists (
      select 1 from journal_entries je
      join org_members om on om.org_id = je.org_id
      where je.id = entry_lines.entry_id
      and om.user_id = auth.uid()
      and om.role in ('OWNER', 'ADMIN', 'ACCOUNTANT')
    )
  );

alter table audit_logs enable row level security;

create policy "Admins can view audit logs" on audit_logs
  for select using (
    exists (
      select 1 from org_members
      where org_id = audit_logs.org_id
      and user_id = auth.uid()
      and role in ('OWNER', 'ADMIN', 'AUDITOR')
    )
  );

create policy "System can insert audit logs" on audit_logs
  for insert with check (true);

alter table subscriptions enable row level security;

create policy "Members can view subscription" on subscriptions
  for select using (
    exists (select 1 from org_members where org_id = subscriptions.org_id and user_id = auth.uid())
  );

alter table attachments enable row level security;

create policy "Members can view attachments" on attachments
  for select using (
    exists (select 1 from org_members where org_id = attachments.org_id and user_id = auth.uid())
  );

-- =============================================================================
-- TRIGGERS & FUNCTIONS
-- =============================================================================

create or replace function check_posting_balance()
returns trigger language plpgsql as $$
declare
  sum_debit  numeric;
  sum_credit numeric;
begin
  if new.status = 'POSTED' and old.status != 'POSTED' then
    select sum(debit), sum(credit)
    into sum_debit, sum_credit
    from entry_lines
    where entry_id = new.id;

    if abs(coalesce(sum_debit, 0) - coalesce(sum_credit, 0)) > 0.001 then
      raise exception 'Cannot post unbalanced entry: debits (%) != credits (%)',
        coalesce(sum_debit, 0), coalesce(sum_credit, 0);
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_double_entry
  before update on journal_entries
  for each row execute function check_posting_balance();

create or replace function get_account_balance(
  p_org_id    uuid,
  p_as_of     date default current_date
)
returns table (
  account_id   uuid,
  code         text,
  name         text,
  type         account_type,
  debit_total  numeric,
  credit_total numeric,
  balance      numeric
) language sql security definer as $$
  select
    a.id as account_id,
    a.code,
    a.name,
    a.type,
    coalesce(sum(el.debit), 0) as debit_total,
    coalesce(sum(el.credit), 0) as credit_total,
    case
      when a.type in ('ASSET', 'EXPENSE') then coalesce(sum(el.debit), 0) - coalesce(sum(el.credit), 0)
      else coalesce(sum(el.credit), 0) - coalesce(sum(el.debit), 0)
    end as balance
  from accounts a
  left join entry_lines el on el.account_id = a.id
  left join journal_entries je on je.id = el.entry_id
    and je.status = 'POSTED'
    and je.date <= p_as_of
  where a.org_id = p_org_id
    and a.is_active = true
  group by a.id, a.code, a.name, a.type
  order by a.code;
$$;

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_updated_at before update on organizations
  for each row execute function update_updated_at();

create trigger accounts_updated_at before update on accounts
  for each row execute function update_updated_at();

create trigger journal_entries_updated_at before update on journal_entries
  for each row execute function update_updated_at();

create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function update_updated_at();

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_org_id   uuid;
  v_org_name text;
begin
  v_org_name := coalesce(new.raw_user_meta_data->>'org_name', 'My Organization');

  insert into organizations (name, owner_id, plan)
  values (v_org_name, new.id, 'FREE')
  returning id into v_org_id;

  insert into org_members (org_id, user_id, role, accepted_at)
  values (v_org_id, new.id, 'OWNER', now());

  insert into subscriptions (org_id, plan, status)
  values (v_org_id, 'STARTER', 'TRIAL');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();