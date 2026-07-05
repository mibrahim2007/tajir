-- Tenant-wise, document-wise, year-reset serial numbers for
-- purchase orders, sale invoices, purchase returns and sale returns.
-- Format: <PREFIX>-<YYYY>-<NNNN>  e.g. PO-2026-0001

-- 1. Per-(tenant, doc_type, year) counter
CREATE TABLE IF NOT EXISTS document_serials (
  tenant_id   uuid    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  doc_type    text    NOT NULL,
  year        integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, doc_type, year)
);

ALTER TABLE document_serials ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role (admin) client touches this table; RLS
-- denies all access to anon/authenticated while service_role bypasses it.

-- 2. Atomic allocator — increments the counter and returns the formatted serial.
--    ON CONFLICT DO UPDATE takes a row lock, so concurrent callers serialize
--    and never receive a duplicate number.
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

-- 3. Serial-number columns
ALTER TABLE purchase_orders  ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE sales_orders     ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE sale_returns     ADD COLUMN IF NOT EXISTS serial_number text;

-- 4a. Backfill purchase orders (multi-line invoices share one serial via invoice_id)
WITH docs AS (
  SELECT COALESCE(invoice_id, id) AS doc_key, tenant_id,
         MIN(date) AS doc_date, MIN(created_at) AS doc_created
  FROM purchase_orders GROUP BY COALESCE(invoice_id, id), tenant_id
),
ranked AS (
  SELECT doc_key, tenant_id, EXTRACT(YEAR FROM doc_date)::int AS yr,
         row_number() OVER (PARTITION BY tenant_id, EXTRACT(YEAR FROM doc_date)::int
                            ORDER BY doc_created, doc_key) AS rn
  FROM docs
)
UPDATE purchase_orders p
SET serial_number = 'PO-' || r.yr || '-' || lpad(r.rn::text, 4, '0')
FROM ranked r
WHERE COALESCE(p.invoice_id, p.id) = r.doc_key AND p.tenant_id = r.tenant_id;

-- 4b. Backfill sale invoices
WITH docs AS (
  SELECT COALESCE(invoice_id, id) AS doc_key, tenant_id,
         MIN(date) AS doc_date, MIN(created_at) AS doc_created
  FROM sales_orders GROUP BY COALESCE(invoice_id, id), tenant_id
),
ranked AS (
  SELECT doc_key, tenant_id, EXTRACT(YEAR FROM doc_date)::int AS yr,
         row_number() OVER (PARTITION BY tenant_id, EXTRACT(YEAR FROM doc_date)::int
                            ORDER BY doc_created, doc_key) AS rn
  FROM docs
)
UPDATE sales_orders p
SET serial_number = 'SI-' || r.yr || '-' || lpad(r.rn::text, 4, '0')
FROM ranked r
WHERE COALESCE(p.invoice_id, p.id) = r.doc_key AND p.tenant_id = r.tenant_id;

-- 4c. Backfill purchase returns (one row = one document)
WITH ranked AS (
  SELECT id, EXTRACT(YEAR FROM date)::int AS yr,
         row_number() OVER (PARTITION BY tenant_id, EXTRACT(YEAR FROM date)::int
                            ORDER BY created_at, id) AS rn
  FROM purchase_returns
)
UPDATE purchase_returns p
SET serial_number = 'PR-' || r.yr || '-' || lpad(r.rn::text, 4, '0')
FROM ranked r WHERE p.id = r.id;

-- 4d. Backfill sale returns
WITH ranked AS (
  SELECT id, EXTRACT(YEAR FROM date)::int AS yr,
         row_number() OVER (PARTITION BY tenant_id, EXTRACT(YEAR FROM date)::int
                            ORDER BY created_at, id) AS rn
  FROM sale_returns
)
UPDATE sale_returns p
SET serial_number = 'SR-' || r.yr || '-' || lpad(r.rn::text, 4, '0')
FROM ranked r WHERE p.id = r.id;

-- 5. Seed the counters so new documents continue after the backfilled ones.
INSERT INTO document_serials (tenant_id, doc_type, year, last_number)
SELECT tenant_id, 'purchase_order', yr, count(*)
FROM (SELECT tenant_id, EXTRACT(YEAR FROM MIN(date))::int AS yr
      FROM purchase_orders GROUP BY COALESCE(invoice_id, id), tenant_id) d
GROUP BY tenant_id, yr
ON CONFLICT (tenant_id, doc_type, year) DO UPDATE SET last_number = EXCLUDED.last_number;

INSERT INTO document_serials (tenant_id, doc_type, year, last_number)
SELECT tenant_id, 'sale_invoice', yr, count(*)
FROM (SELECT tenant_id, EXTRACT(YEAR FROM MIN(date))::int AS yr
      FROM sales_orders GROUP BY COALESCE(invoice_id, id), tenant_id) d
GROUP BY tenant_id, yr
ON CONFLICT (tenant_id, doc_type, year) DO UPDATE SET last_number = EXCLUDED.last_number;

INSERT INTO document_serials (tenant_id, doc_type, year, last_number)
SELECT tenant_id, 'purchase_return', EXTRACT(YEAR FROM date)::int, count(*)
FROM purchase_returns GROUP BY tenant_id, EXTRACT(YEAR FROM date)::int
ON CONFLICT (tenant_id, doc_type, year) DO UPDATE SET last_number = EXCLUDED.last_number;

INSERT INTO document_serials (tenant_id, doc_type, year, last_number)
SELECT tenant_id, 'sale_return', EXTRACT(YEAR FROM date)::int, count(*)
FROM sale_returns GROUP BY tenant_id, EXTRACT(YEAR FROM date)::int
ON CONFLICT (tenant_id, doc_type, year) DO UPDATE SET last_number = EXCLUDED.last_number;
