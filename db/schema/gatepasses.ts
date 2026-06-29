import { pgTable, uuid, text, date, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { purchaseOrders } from './purchases'
import { salesOrders } from './sales'

export const gatepasses = pgTable('gatepasses', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  gateppassNumber: text('gatepass_number').notNull(),
  type:            text('type').notNull(), // 'purchase' | 'sale'
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
  salesOrderId:    uuid('sales_order_id').references(() => salesOrders.id),
  entryDate:       date('entry_date').notNull(),
  date:            date('date').notNull(),
  vehicleNumber:   text('vehicle_number').notNull(),
  driverName:      text('driver_name').notNull(),
  remarks:         text('remarks'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Gatepass    = typeof gatepasses.$inferSelect
export type NewGatepass = typeof gatepasses.$inferInsert
