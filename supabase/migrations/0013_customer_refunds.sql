-- ============================================================
-- 0013: Customer Refunds
--       Cash/bank payments made OUT to customers who have a
--       credit balance (e.g. after a fully-paid sale return).
--       GL: DR Accounts Receivable, CR Cash in Hand / Cash at Bank
-- ============================================================

CREATE TABLE "customer_refunds" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"           uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "customer_id"         uuid NOT NULL REFERENCES "tajir_customers"("id"),
  "amount"              numeric(15, 2) NOT NULL,
  "currency_code"       char(3) NOT NULL DEFAULT 'PKR',
  "exchange_rate"       numeric(10, 4) NOT NULL DEFAULT '1',
  "pkr_equivalent"      numeric(15, 2) NOT NULL,
  "date"                date NOT NULL,
  "payment_method"      text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer')),
  "notes"               text,
  "created_at"          timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "customer_refunds" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_refunds_tenant_isolation"
  ON "customer_refunds" FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');
