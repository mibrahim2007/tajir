-- ============================================================
-- 0017: Payment due date on purchase orders
-- Mirrors sales_orders.payment_due_date so purchases can be
-- tracked as overdue the same way sales already are.
-- ============================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS payment_due_date date;
