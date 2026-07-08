-- Links a customer account to its supplier counterpart (same real-world party
-- that both buys from and sells to us) so their AR and AP ledgers can be
-- consolidated into a single net statement. One-to-one within a tenant.
CREATE TABLE IF NOT EXISTS public.party_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid        NOT NULL REFERENCES public.tajir_customers(id) ON DELETE CASCADE,
  supplier_id uuid        NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, customer_id),
  UNIQUE (tenant_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_party_links_tenant ON public.party_links (tenant_id);
