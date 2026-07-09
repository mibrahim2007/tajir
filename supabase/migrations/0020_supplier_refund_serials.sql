-- Serial numbers for "Receive Payment" vouchers (supplier_refunds, prefix RCV).
-- Mirrors 0019; extends next_document_serial with a supplier_refund branch.

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
    WHEN 'supplier_refund' THEN 'RCV'
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

ALTER TABLE supplier_refunds ADD COLUMN IF NOT EXISTS serial_number text;

-- Backfill existing rows, per (tenant, year), ordered by creation.
WITH ranked AS (
  SELECT id, EXTRACT(YEAR FROM date)::int AS yr,
         row_number() OVER (PARTITION BY tenant_id, EXTRACT(YEAR FROM date)::int
                            ORDER BY created_at, id) AS rn
  FROM supplier_refunds
)
UPDATE supplier_refunds t
SET serial_number = 'RCV-' || r.yr || '-' || lpad(r.rn::text, 4, '0')
FROM ranked r WHERE t.id = r.id AND t.serial_number IS NULL;

-- Seed the counter so new vouchers continue after the backfilled ones.
INSERT INTO document_serials (tenant_id, doc_type, year, last_number)
SELECT tenant_id, 'supplier_refund', EXTRACT(YEAR FROM date)::int, count(*)
FROM supplier_refunds GROUP BY tenant_id, EXTRACT(YEAR FROM date)::int
ON CONFLICT (tenant_id, doc_type, year) DO UPDATE SET last_number = EXCLUDED.last_number;
