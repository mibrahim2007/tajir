-- Customer status: manual classification shown on the customer list, detail page
-- and used as a filter. One of active / inactive / low_transaction; defaults to
-- 'active' for existing and new customers.

ALTER TABLE public.tajir_customers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tajir_customers_status_check') THEN
    ALTER TABLE public.tajir_customers
      ADD CONSTRAINT tajir_customers_status_check CHECK (status IN ('active', 'inactive', 'low_transaction'));
  END IF;
END $$;
