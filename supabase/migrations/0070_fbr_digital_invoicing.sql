-- ── FBR Digital Invoicing (PRAL DI API v1.12) ────────────────────────────
-- Per-tenant FBR sales-tax e-invoicing. Phase 1 = sandbox: a tenant enters its
-- seller details and PRAL sandbox token, then raises FBR tax invoices to either
-- a Registered or an Unregistered buyer and validates / posts them to FBR.
--
--   fbr_settings      one row per tenant: seller identity, business activity /
--                     sector (decides the applicable sandbox scenarios), active
--                     environment, cached reference lists, last connection test.
--   fbr_credentials   the PRAL bearer tokens, AES-256-GCM encrypted by the app
--                     (key in the server env, never in the database). RLS on
--                     with NO policies: only the service role can read it.
--   fbr_invoices      the tax invoice header + FBR outcome (invoice number,
--                     status, last request / response). Locked once posted.
--   fbr_invoice_items the lines, field-for-field with the DI API item model.
--   fbr_api_log       every call made to FBR, for support and audit.
--
-- FBR invoices are tax documents only in phase 1: they post nothing to the GL
-- and are not linked to Tajir sale invoices.

create table if not exists public.fbr_settings (
  tenant_id            uuid primary key references public.tenants(id) on delete cascade,
  enabled              boolean not null default false,
  environment          text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  seller_ntn_cnic      text,
  seller_business_name text,
  seller_province      text,
  seller_address       text,
  business_activity    text,
  sector               text,
  further_tax_rate     numeric(5,2) not null default 4,
  reference_cache      jsonb,
  last_test_at         timestamptz,
  last_test_ok         boolean,
  last_test_message    text,
  updated_at           timestamptz not null default now(),
  updated_by           uuid
);

create table if not exists public.fbr_credentials (
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  environment   text not null check (environment in ('sandbox', 'production')),
  token_enc     text not null,
  token_last4   text not null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  primary key (tenant_id, environment)
);

create table if not exists public.fbr_invoices (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  serial_number            text,
  environment              text not null check (environment in ('sandbox', 'production')),
  invoice_type             text not null default 'Sale Invoice' check (invoice_type in ('Sale Invoice', 'Debit Note')),
  invoice_date             date not null,
  buyer_registration_type  text not null check (buyer_registration_type in ('Registered', 'Unregistered')),
  buyer_ntn_cnic           text,
  buyer_business_name      text not null,
  buyer_province           text not null,
  buyer_address            text not null,
  customer_id              uuid references public.tajir_customers(id) on delete set null,
  invoice_ref_no           text,
  scenario_id              text,
  total_value_excl_st      numeric(15,2) not null default 0,
  total_sales_tax          numeric(15,2) not null default 0,
  total_further_tax        numeric(15,2) not null default 0,
  total_amount             numeric(15,2) not null default 0,
  status                   text not null default 'draft'
                             check (status in ('draft', 'valid', 'invalid', 'posting', 'posted', 'failed')),
  fbr_invoice_number       text,
  fbr_dated                text,
  last_error               text,
  last_request             jsonb,
  last_response            jsonb,
  posted_at                timestamptz,
  created_by               uuid,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists fbr_invoices_tenant_date_idx on public.fbr_invoices (tenant_id, invoice_date desc);
create unique index if not exists fbr_invoices_fbr_number_uidx
  on public.fbr_invoices (fbr_invoice_number) where fbr_invoice_number is not null;

create table if not exists public.fbr_invoice_items (
  id                                   uuid primary key default gen_random_uuid(),
  tenant_id                            uuid not null references public.tenants(id) on delete cascade,
  invoice_id                           uuid not null references public.fbr_invoices(id) on delete cascade,
  line_no                              int not null,
  hs_code                              text not null,
  product_description                  text not null,
  rate                                 text not null,
  uom                                  text not null,
  quantity                             numeric(18,4) not null,
  unit_price                           numeric(15,2) not null default 0,
  value_sales_excluding_st             numeric(15,2) not null,
  fixed_notified_value_or_retail_price numeric(15,2) not null default 0,
  sales_tax_applicable                 numeric(15,2) not null default 0,
  sales_tax_withheld_at_source         numeric(15,2) not null default 0,
  extra_tax                            numeric(15,2) not null default 0,
  further_tax                          numeric(15,2) not null default 0,
  fed_payable                          numeric(15,2) not null default 0,
  discount                             numeric(15,2) not null default 0,
  total_values                         numeric(15,2) not null default 0,
  sale_type                            text not null,
  sro_schedule_no                      text,
  sro_item_serial_no                   text,
  fbr_item_invoice_no                  text,
  unique (invoice_id, line_no)
);

create index if not exists fbr_invoice_items_invoice_idx on public.fbr_invoice_items (invoice_id);

create table if not exists public.fbr_api_log (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  fbr_invoice_id  uuid references public.fbr_invoices(id) on delete set null,
  environment     text not null,
  method          text not null,
  endpoint        text not null,
  http_status     int,
  duration_ms     int,
  request         jsonb,
  response        jsonb,
  error           text,
  created_at      timestamptz not null default now()
);

create index if not exists fbr_api_log_tenant_idx on public.fbr_api_log (tenant_id, created_at desc);

-- ── RLS: tenant may read its own rows; all writes go through server actions.
alter table public.fbr_settings      enable row level security;
alter table public.fbr_credentials   enable row level security;  -- no policies: service role only
alter table public.fbr_invoices      enable row level security;
alter table public.fbr_invoice_items enable row level security;
alter table public.fbr_api_log       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['fbr_settings', 'fbr_invoices', 'fbr_invoice_items', 'fbr_api_log'] loop
    execute format('drop policy if exists "%1$s: tenant select" on public.%1$I', t);
    execute format(
      'create policy "%1$s: tenant select" on public.%1$I for select using (tenant_id = (((auth.jwt() -> ''app_metadata'') ->> ''tenant_id''))::uuid)',
      t);
  end loop;
end $$;

-- ── Serial: FTI-YYYY-NNNN for FBR tax invoices. Same function as before with
-- one extra CASE arm (keep in sync with lib/serials/next-serial.ts).
create or replace function public.next_document_serial(p_tenant_id uuid, p_doc_type text, p_date date)
 returns text
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_year   integer := extract(year from p_date)::int;
  v_number integer;
  v_prefix text;
begin
  v_prefix := case p_doc_type
    when 'purchase_order'     then 'PO'
    when 'sale_invoice'       then 'SI'
    when 'purchase_return'    then 'PR'
    when 'sale_return'        then 'SR'
    when 'ar_receipt'         then 'RCP'
    when 'ap_payment'         then 'PAY'
    when 'customer_refund'    then 'REF'
    when 'supplier_refund'    then 'RCV'
    when 'employee_loan'      then 'LN'
    when 'loan_repayment'     then 'LR'
    when 'owner_withdrawal'   then 'OW'
    when 'owner_contribution' then 'OC'
    when 'profit_allocation'  then 'PA'
    when 'agent_payment'      then 'AGP'
    when 'fbr_invoice'        then 'FTI'
    else 'DOC'
  end;

  insert into document_serials (tenant_id, doc_type, year, last_number)
  values (p_tenant_id, p_doc_type, v_year, 1)
  on conflict (tenant_id, doc_type, year)
  do update set last_number = document_serials.last_number + 1
  returning last_number into v_number;

  return v_prefix || '-' || v_year || '-' || lpad(v_number::text, 4, '0');
end;
$function$;
