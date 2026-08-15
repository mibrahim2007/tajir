/**
 * Absolute site origin (no trailing slash) for building shareable links.
 * Override with NEXT_PUBLIC_SITE_URL; defaults to the production domain.
 */
export function getBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  return (fromEnv || 'https://tajir.jappx.com').replace(/\/+$/, '')
}
