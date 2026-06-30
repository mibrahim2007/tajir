import { pgTable, uuid, text, numeric, timestamp, check, unique } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenants'

export const inventoryTypeValues = ['Combed', 'Carded'] as const
export type InventoryType = (typeof inventoryTypeValues)[number]

export const inventoryLots = pgTable(
  'inventory_lots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code'),
    count: text('count').notNull(),
    type: text('type'),
    fiber: text('fiber'),
    lot: text('lot'),
    // FK to suppliers added in migration 3 via ALTER TABLE
    defaultSupplierId: uuid('default_supplier_id'),
    unitOfMeasure: text('unit_of_measure'),
    currentQuantity: numeric('current_quantity', { precision: 15, scale: 3 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('uq_inventory_lots_tenant_name').on(table.tenantId, table.name),
    check('chk_inventory_lots_qty_non_negative', sql`${table.currentQuantity} >= 0`),
  ],
)

export type InventoryLot = typeof inventoryLots.$inferSelect
export type NewInventoryLot = typeof inventoryLots.$inferInsert
