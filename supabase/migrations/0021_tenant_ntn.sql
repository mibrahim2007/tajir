-- Business National Tax Number (NTN) per tenant, shown on invoice/voucher printouts.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ntn text;
