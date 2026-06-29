-- ============================================================
-- 0012: Debit Notes (against suppliers) and Credit Notes (against customers)
--       Financial adjustments only — no stock movement
-- ============================================================

-- ── Debit Notes ──────────────────────────────────────────────
-- Issued to supplier: reduces what we owe them (DR AP, CR Purchase Returns Contra)
CREATE TABLE "debit_notes" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"           uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "supplier_id"         uuid NOT NULL REFERENCES "suppliers"("id"),
  "purchase_order_id"   uuid REFERENCES "purchase_orders"("id"),
  "amount"              numeric(15, 2) NOT NULL,
  "currency_code"       char(3) NOT NULL DEFAULT 'PKR',
  "exchange_rate"       numeric(10, 4) NOT NULL DEFAULT '1',
  "pkr_equivalent"      numeric(15, 2) NOT NULL,
  "date"                date NOT NULL,
  "reason"              text,
  "reference"           text,
  "created_at"          timestamp with time zone DEFAULT now() NOT NULL
);

-- ── Credit Notes ─────────────────────────────────────────────
-- Issued to customer: reduces what they owe us (DR Sales Returns Contra, CR AR)
CREATE TABLE "credit_notes" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"       uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "customer_id"     uuid NOT NULL REFERENCES "tajir_customers"("id"),
  "sale_order_id"   uuid REFERENCES "sales_orders"("id"),
  "amount"          numeric(15, 2) NOT NULL,
  "currency_code"   char(3) NOT NULL DEFAULT 'PKR',
  "exchange_rate"   numeric(10, 4) NOT NULL DEFAULT '1',
  "pkr_equivalent"  numeric(15, 2) NOT NULL,
  "date"            date NOT NULL,
  "reason"          text,
  "reference"       text,
  "created_at"      timestamp with time zone DEFAULT now() NOT NULL
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE "debit_notes"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_notes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "debit_notes_tenant_isolation"
  ON "debit_notes" FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

CREATE POLICY "credit_notes_tenant_isolation"
  ON "credit_notes" FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');
