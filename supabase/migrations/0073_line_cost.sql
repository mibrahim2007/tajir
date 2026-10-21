-- ── Cost of goods at cost, not at the selling price ──────────────────────────
--
-- Until now a sale posted DR COGS / CR Stock in Trade at the line's SALE amount
-- (and a sale return reversed it the same way), so gross profit in the books
-- was always zero and Stock in Trade drifted away from what the stock cost.
--
-- Each sale line and sale-return line now records the cost it was relieved at:
--
--   cost_rate    cost per stock unit (per kg for weighed yarn, per Nos
--                otherwise) — the lot's / grade's own receipt cost for items
--                whose type tracks them, else the item's average receipt cost
--                (opening stock + purchases − purchase returns, up to the date)
--   cost_amount  cost_rate × quantity, in PKR — what the GL entry posts
--
-- A sale return linked to a sale line reverses at that line's cost_rate, so a
-- return never moves stock back in at a different value than it went out.
-- Rows posted before this migration keep NULL: their journal entries are not
-- rewritten here (re-saving an invoice reposts it at cost).

alter table public.sales_orders
  add column if not exists cost_rate   numeric(18,4),
  add column if not exists cost_amount numeric(15,2);

alter table public.sale_returns
  add column if not exists cost_rate   numeric(18,4),
  add column if not exists cost_amount numeric(15,2);

notify pgrst, 'reload schema';
