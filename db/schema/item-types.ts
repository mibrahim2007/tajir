import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

// Per-tenant item categories (e.g. Yarn, Fabric, Electric). Referenced by
// inventory_lots.item_type_id. Added to the DB in migration 0011_item_types.sql.
export const itemTypes = pgTable(
  'item_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('item_types_tenant_id_name_key').on(table.tenantId, table.name)],
)

export type ItemType = typeof itemTypes.$inferSelect
export type NewItemType = typeof itemTypes.$inferInsert
