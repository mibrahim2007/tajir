import { pgTable, uuid, text, numeric, timestamp, check, unique } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenants'
import { itemTypes } from './item-types'

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
    // Auto-assigned scannable business code (barcode payload); the DB default
    // mints the next 'TJR-000123' from a sequence, so inserts may omit it.
    sku: text('sku')
      .notNull()
      .default(sql`('TJR-'::text || lpad((nextval('inventory_lot_sku_seq'::regclass))::text, 6, '0'::text))`),
    code: text('code'),
    // Numeric (unbounded) and nullable. Forms collect free text and coerce it
    // with lib/parse-count.ts before writing.
    count: numeric('count'),
    // Legacy free-text spin type, constrained to Combed/Carded. Superseded by
    // itemTypeId for categorization.
    type: text('type'),
    fiber: text('fiber'),
    lot: text('lot'),
    // FK to suppliers added in migration 3 via ALTER TABLE.
    defaultSupplierId: uuid('default_supplier_id'),
    currentQuantity: numeric('current_quantity', { precision: 15, scale: 3 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // FK to item_types (categories); ON DELETE SET NULL.
    itemTypeId: uuid('item_type_id').references(() => itemTypes.id, { onDelete: 'set null' }),
    // Opening rate captured at item creation.
    openingRate: numeric('opening_rate', { precision: 18, scale: 4 }).notNull().default('0'),
    unitOfMeasure: text('unit_of_measure'),
    // FK to locations added via ALTER TABLE; kept as a plain uuid to avoid a
    // schema import cycle (mirrors defaultSupplierId).
    locationId: uuid('location_id'),
  },
  (table) => [
    unique('uq_inventory_lots_tenant_name').on(table.tenantId, table.name),
    unique('uq_inventory_lots_tenant_sku').on(table.tenantId, table.sku),
    check('inventory_lots_current_quantity_check', sql`${table.currentQuantity} >= 0`),
    check('inventory_lots_type_check', sql`${table.type} = ANY (ARRAY['Combed'::text, 'Carded'::text])`),
  ],
)

export type InventoryLot = typeof inventoryLots.$inferSelect
export type NewInventoryLot = typeof inventoryLots.$inferInsert
