-- Auto-generated serial numbers for money-movement vouchers:
--   Receipt (ar_receipts, RCP), Payment (ap_payments, PAY), Customer Refund (customer_refunds, REF)
-- Mirrors the document-serial mechanism from 0018 (next_document_serial).
-- Format: <PREFIX>-<YYYY>-<NNNN>  e.g. RCP-2026-0001

-- 1. Extend the atomic allocator with the three new document types.
CREATE OR REPLACE FUNCTION next_document_serial(
  p_tenant_id uuid,
  p_doc_type  text,
  p_date      date
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year   integer := EXTRACT(YEAR FROM p_date)::int;
  v_number integer;
  v_prefix text;
BEGIN
  v_prefix := CASE p_doc_type
    WHEN 'purchase_order'  THEN 'PO'
    WHEN 'sale_invoice'    THEN 'SI'
    WHEN 'purchase_return' THEN 'PR'
    WHEN 'sale_return'     THEN 'SR'
    WHEN 'ar_receipt'      THEN 'RCP'
    WHEN 'ap_payment'      THEN 'PAY'
    WHEN 'customer_refund' THEN 'REF'
    ELSE 'DOC'
  END;

  INSERT INTO document_serials (tenant_id, doc_type, year, last_number)
  VALUES (p_tenant_id, p_doc_type, v_year, 1)
  ON CONFLICT (tenant_id, doc_type, year)
  DO UPDATE SET last_number = document_serials.last_number + 1
  RETURNING last_number INTO v_number;

  RETURN v_prefix || '-' || v_year || '-' || lpad(v_number::text, 4, '0');
END;
$$;

-- 2. Serial-number columns (one row = one voucher for all three tables)
ALTER TABLE ar_receipts      ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE ap_payments      ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE customer_refunds ADD COLUMN IF NOT EXISTS serial_number text;

-- 3. Backfill existing rows, per (tenant, year), ordered by creation.
WITH ranked AS (
  SELECT id, EXTRACT(YEAR FROM date)::int AS yr,
         row_number() OVER (PARTITION BY tenant_id, EXTRACT(YEAR FROM date)::int
                            ORDER BY created_at, id) AS rn
  FROM ar_receipts
)
UPDATE ar_receipts t
SET serial_number = 'RCP-' || r.yr || '-' || lpad(r.rn::text, 4, '0')
FROM ranked r WHERE t.id = r.id AND t.serial_number IS NULL;

WITH ranked AS (
  SELECT id, EXTRACT(YEAR FROM date)::int AS yr,
         row_number() OVER (PARTITION BY tenant_id, EXTRACT(YEAR FROM date)::int
                            ORDER BY created_at, id) AS rn
  FROM ap_payments
)
UPDATE ap_payments t
SET serial_number = 'PAY-' || r.yr || '-' || lpad(r.rn::text, 4, '0')
FROM ranked r WHERE t.id = r.id AND t.serial_number IS NULL;

WITH ranked AS (
  SELECT id, EXTRACT(YEAR FROM date)::int AS yr,
         row_number() OVER (PARTITION BY tenant_id, EXTRACT(YEAR FROM date)::int
                            ORDER BY created_at, id) AS rn
  FROM customer_refunds
)
UPDATE customer_refunds t
SET serial_number = 'REF-' || r.yr || '-' || lpad(r.rn::text, 4, '0')
FROM ranked r WHERE t.id = r.id AND t.serial_number IS NULL;

-- 4. Seed the counters so new vouchers continue after the backfilled ones.
INSERT INTO document_serials (tenant_id, doc_type, year, last_number)
SELECT tenant_id, 'ar_receipt', EXTRACT(YEAR FROM date)::int, count(*)
FROM ar_receipts GROUP BY tenant_id, EXTRACT(YEAR FROM date)::int
ON CONFLICT (tenant_id, doc_type, year) DO UPDATE SET last_number = EXCLUDED.last_number;

INSERT INTO document_serials (tenant_id, doc_type, year, last_number)
SELECT tenant_id, 'ap_payment', EXTRACT(YEAR FROM date)::int, count(*)
FROM ap_payments GROUP BY tenant_id, EXTRACT(YEAR FROM date)::int
ON CONFLICT (tenant_id, doc_type, year) DO UPDATE SET last_number = EXCLUDED.last_number;

INSERT INTO document_serials (tenant_id, doc_type, year, last_number)
SELECT tenant_id, 'customer_refund', EXTRACT(YEAR FROM date)::int, count(*)
FROM customer_refunds GROUP BY tenant_id, EXTRACT(YEAR FROM date)::int
ON CONFLICT (tenant_id, doc_type, year) DO UPDATE SET last_number = EXCLUDED.last_number;
