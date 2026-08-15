
-- P7: Remove empty-string default from gatepass_number.
-- Column is already NOT NULL with 0 empty-string rows — safe to drop default.
-- Document numbers must be explicitly assigned; silent empty defaults mask bugs.
ALTER TABLE public.gatepasses ALTER COLUMN gatepass_number DROP DEFAULT;

-- P8: Cast inventory_lots.count from text to numeric.
-- All 4 existing rows contain purely numeric values — safe to cast.
ALTER TABLE public.inventory_lots ALTER COLUMN count TYPE numeric USING count::numeric;
