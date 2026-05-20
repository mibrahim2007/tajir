-- pg_cron subscription lifecycle jobs (AR-15)
-- Requires pg_cron extension enabled on the Supabase project

-- Job 1: Grace period → Locked
-- Runs daily at 02:00 UTC. Transitions tenants from grace_period to locked
-- after 7 days have elapsed since subscription_expires_at.
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

-- Job 2: Locked → Data deletion
-- Runs daily at 03:00 UTC. Permanently deletes data for cancelled tenants
-- after 90 days in locked/cancelled state.
-- Cascading FKs handle child record deletion via ON DELETE CASCADE on tenant_id.
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
