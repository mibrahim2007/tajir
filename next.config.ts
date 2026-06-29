import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  telemetry: false,
  disableLogger: true,
  // Only upload source maps when SENTRY_DSN is configured
  sourcemaps: {
    disable: !process.env.SENTRY_DSN,
  },
})
