import { pgTable, uuid, text, timestamp, integer, bigint, inet } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

// Keep in sync with the CHECK constraint in 0063_api_keys.sql.
export const apiScopeEnum = [
  'customers:read',
  'suppliers:read',
  'ledger:read',
  'sales:read',
  'purchases:read',
  'inventory:read',
  'reports:read',
] as const
export type ApiScope = (typeof apiScopeEnum)[number]

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  scopes: text('scopes').array().$type<ApiScope[]>().notNull().default([]),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})

export const apiKeyRequests = pgTable('api_key_requests', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  apiKeyId: uuid('api_key_id')
    .notNull()
    .references(() => apiKeys.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  method: text('method').notNull(),
  path: text('path').notNull(),
  status: integer('status').notNull(),
  rowCount: integer('row_count'),
  ip: inet('ip'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ApiKey = typeof apiKeys.$inferSelect
export type ApiKeyRequest = typeof apiKeyRequests.$inferSelect
