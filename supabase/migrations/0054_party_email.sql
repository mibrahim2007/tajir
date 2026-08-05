-- Party email addresses.
--
-- Ask (/ask) can now email an answer, and the most useful destination for a
-- party's ledger or business summary is the party themselves. Neither table
-- carried any contact detail, so there was nothing to send to. Nullable and
-- unvalidated at the database level — the app validates the format, and a
-- party with no email simply cannot be picked as a recipient.

alter table public.tajir_customers add column if not exists email text;
alter table public.suppliers       add column if not exists email text;

comment on column public.tajir_customers.email is 'Optional contact email; offered as a recipient when emailing an Ask answer about this customer.';
comment on column public.suppliers.email       is 'Optional contact email; offered as a recipient when emailing an Ask answer about this supplier.';
