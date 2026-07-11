-- Per-bank opening balance: the balance a bank account already held when the
-- business started using Tajir. Used to seed the running balance in the Bank
-- Statement / reconciliation report. This is separate from the GL "Cash at Bank"
-- account opening balance (which posts a journal entry).
alter table banks
  add column if not exists opening_balance numeric(15,2) not null default 0;
