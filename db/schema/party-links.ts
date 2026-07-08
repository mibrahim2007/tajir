import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { tajirCustomers } from './sales'
import { suppliers } from './purchases'

// Links a customer account to its supplier counterpart (the same real-world
// party we both sell to and buy from) so their ledgers can be consolidated.
// One-to-one within a tenant. Added in migration 0021_party_links.sql.
export const partyLinks = pgTable(
  'party_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => tajirCustomers.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('party_links_tenant_id_customer_id_key').on(table.tenantId, table.customerId),
    unique('party_links_tenant_id_supplier_id_key').on(table.tenantId, table.supplierId),
  ],
)

export type PartyLink = typeof partyLinks.$inferSelect
export type NewPartyLink = typeof partyLinks.$inferInsert
