
-- Replace grace-to-locked job with correct SQL (no locked_at column in our schema)
SELECT cron.unschedule('grace-to-locked');

SELECT cron.schedule(
  'grace-to-locked',
  '0 2 * * *',
  $$
    UPDATE tenants
    SET subscription_status = 'locked'
    WHERE subscription_status = 'grace_period'
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at < now() - INTERVAL '7 days';
  $$
);

-- Add missing locked-to-deletion job
SELECT cron.schedule(
  'locked-to-deletion',
  '0 3 * * *',
  $$
    DELETE FROM tenants
    WHERE subscription_status IN ('locked', 'cancelled')
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at < now() - INTERVAL '90 days';
  $$
);
