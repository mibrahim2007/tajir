-- Add optional phone number to customers (used for WhatsApp sharing of sale invoices)
alter table tajir_customers add column if not exists phone text;
