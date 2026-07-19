-- ── Profit allocation reversal / period reopen ──────────────────────
-- Allocating a period's profit "claims" that period: createProfitAllocationAction
-- rejects any overlapping allocation, so a period cannot be allocated twice.
--
-- Reopening a period releases that claim. It does NOT delete the original
-- journal entry — a posted allocation is a real movement of owners' capital and
-- erasing it would rewrite history. Instead a mirror-image entry is posted that
-- cancels the original, leaving both on the ledger, and the allocation is marked
-- `reversed` so the period is free to allocate again.
--
--   Original (profit): DR Retained Earnings / CR Owner's Capital (per owner)
--   Reversal:          DR Owner's Capital (per owner) / CR Retained Earnings
--
-- Only `active` allocations block a period; `reversed` ones are history.

alter table profit_allocations
  add column if not exists status text not null default 'active'
    check (status in ('active', 'reversed')),
  add column if not exists reversed_at timestamptz;

-- The overlap guard filters on status, so index the combination it queries.
create index if not exists profit_allocations_active_period_idx
  on profit_allocations(tenant_id, status, period_start, period_end);
