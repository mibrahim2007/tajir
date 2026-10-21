import { pgTable, uuid, text, timestamp, unique, numeric, boolean, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

// Per-tenant item categories (e.g. Yarn, Fabric, Electric). Every stock item
// has one (inventory_lots.item_type_id, mandatory since 0071). Added to the DB
// in migration 0011_item_types.sql.
// A sub-type is a row whose parent_id points to its parent type (0032).
export const itemTypes = pgTable(
  'item_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Self-reference: NULL for a top-level type, set for a sub-type.
    parentId: uuid('parent_id').references((): AnyPgColumn => itemTypes.id, { onDelete: 'cascade' }),
    // Profile (0071): how items of this type are measured and billed. See
    // lib/item-formula.ts. A sub-type carries its parent's profile.
    formula: text('formula').notNull().default('standard'),
    stockUnit: text('stock_unit'),
    packUnit: text('pack_unit'),
    stdPackWeight: numeric('std_pack_weight', { precision: 12, scale: 3 }),
    trackGrade: boolean('track_grade').notNull().default(false),
    trackLot: boolean('track_lot').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('item_types_tenant_id_name_key').on(table.tenantId, table.name)],
)

export type ItemType = typeof itemTypes.$inferSelect
export type NewItemType = typeof itemTypes.$inferInsert
