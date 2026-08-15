-- ── Customer phone number ───────────────────────────────────────────
-- Optional. Drives the wa.me deep link when a sale invoice is shared with the
-- customer over WhatsApp; nothing else depends on it being present.
--
-- Renumbered from 0018 on merge: that number was already taken by
-- 0018_document_serials.sql on master, which this branch predates.
alter table tajir_customers add column if not exists phone text;
