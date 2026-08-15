
-- PG 17 confirmed. reloptions were null (security_invoker not set).
-- Set security_invoker = true so the views execute as the calling user,
-- respecting RLS policies on the underlying invoices/customers/vendors tables.
ALTER VIEW public.ar_aging SET (security_invoker = true);
ALTER VIEW public.ap_aging SET (security_invoker = true);
