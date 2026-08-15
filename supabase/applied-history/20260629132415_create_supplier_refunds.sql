
CREATE TABLE supplier_refunds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id    uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  amount         numeric        NOT NULL,
  currency_code  char(3)        NOT NULL DEFAULT 'PKR',
  exchange_rate  numeric        NOT NULL DEFAULT 1,
  pkr_equivalent numeric        NOT NULL,
  date           date           NOT NULL,
  payment_method text           NOT NULL,
  notes          text,
  created_at     timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX supplier_refunds_tenant_idx    ON supplier_refunds(tenant_id);
CREATE INDEX supplier_refunds_supplier_idx  ON supplier_refunds(supplier_id);
