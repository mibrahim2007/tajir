alter table public.tajir_customers add column if not exists email text;
alter table public.suppliers       add column if not exists email text;

comment on column public.tajir_customers.email is 'Optional contact email; offered as a recipient when emailing an Ask answer about this customer.';
comment on column public.suppliers.email       is 'Optional contact email; offered as a recipient when emailing an Ask answer about this supplier.';