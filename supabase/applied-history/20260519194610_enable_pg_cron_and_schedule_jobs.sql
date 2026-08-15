
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Daily job: move grace_period → locked after 7 days past subscription_expires_at
SELECT cron.schedule(
  'grace-to-locked',
  '0 2 * * *',  -- 2 AM UTC daily
  $$
    UPDATE tenants
    SET
      subscription_status = 'locked',
      locked_at = NOW()
    WHERE
      subscription_status = 'grace_period'
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at < NOW() - INTERVAL '7 days';
  $$
);

-- Daily job: delete tenants locked/cancelled for 90+ days
SELECT cron.schedule(
  'locked-to-delete',
  '0 3 * * *',  -- 3 AM UTC daily
  $$
    DELETE FROM tenants
    WHERE
      subscription_status IN ('locked', 'cancelled')
      AND locked_at IS NOT NULL
      AND locked_at < NOW() - INTERVAL '90 days';
  $$
);
