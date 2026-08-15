
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS closed_reviewed boolean NOT NULL DEFAULT false;
-- Mark all already-closed tickets as reviewed so existing users aren't flooded
UPDATE support_tickets SET closed_reviewed = true WHERE status = 'closed';
