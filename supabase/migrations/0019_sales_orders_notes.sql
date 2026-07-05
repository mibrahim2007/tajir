-- ============================================================
-- 0019: Notes on sales orders
-- The create-sale form already collects a Notes field but it was
-- never persisted. Store it per sale line so it can be shown on
-- the invoice printout and the Purchase & Sales report.
-- ============================================================

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS notes text;
