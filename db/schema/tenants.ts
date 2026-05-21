import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core'

export const subscriptionStatusEnum = ['active', 'grace_period', 'locked', 'cancelled'] as const
export type SubscriptionStatus = (typeof subscriptionStatusEnum)[number]

export const roleEnum = ['owner', 'assistant'] as const
export type Role = (typeof roleEnum)[number]

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  subscriptionStatus: text('subscription_status')
    .$type<SubscriptionStatus>()
    .notNull()
    .default('active'),
  subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const tenantUsers = pgTable('tenant_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  username: text('username').unique(),
  role: text('role').$type<Role>().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Tenant = typeof tenants.$inferSelect
export type TenantUser = typeof tenantUsers.$inferSelect
