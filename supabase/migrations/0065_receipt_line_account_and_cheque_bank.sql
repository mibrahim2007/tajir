-- ── Receipt lines: GL account for Online, bank name for PDC ─────────────
-- Banks are not linked to the chart of accounts, so every Online receipt
-- landed in 1120 Cash at Bank whichever bank was picked. A trader who keeps a
-- GL account per bank (or a mobile wallet) had no way to say where the money
-- went. account_id lets an Online line name the asset account to debit;
-- NULL keeps the old behaviour (Cash at Bank).
--
-- A PDC is the customer's cheque, drawn on THEIR bank — usually not one of
-- ours, so it never fit the banks picker. cheque_bank_name is free text for
-- reference only; it posts nothing.

alter table public.ar_receipt_lines
  add column if not exists account_id       uuid references public.chart_of_accounts(id) on delete restrict,
  add column if not exists cheque_bank_name text;

-- Only an Online line chooses where its money lands; any other type posting to
-- an arbitrary account would bypass its own (cash / PDC / payable) logic.
alter table public.ar_receipt_lines
  drop constraint if exists ar_receipt_lines_account_online_only;
alter table public.ar_receipt_lines
  add constraint ar_receipt_lines_account_online_only
  check (account_id is null or transaction_type = 'online');

create index if not exists ar_receipt_lines_account_idx
  on public.ar_receipt_lines (account_id)
  where account_id is not null;
