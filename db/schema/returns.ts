import { pgTable, uuid, text, numeric, date, timestamp, char } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { suppliers } from './purchases'
import { tajirCustomers } from './sales'
import { inventoryLots } from './inventory'
import { purchaseOrders } from './purchases'
import { salesOrders } from './sales'

export const purchaseReturns = pgTable('purchase_returns', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  serialNumber:    text('serial_number'),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
  supplierId:      uuid('supplier_id').notNull().references(() => suppliers.id),
  stockItemId:     uuid('stock_item_id').notNull().references(() => inventoryLots.id),
  quantity:        numeric('quantity', { precision: 15, scale: 3 }).notNull(),
  rate:            numeric('rate', { precision: 15, scale: 2 }).notNull(),
  currencyCode:    char('currency_code', { length: 3 }).notNull().default('PKR'),
  exchangeRate:    numeric('exchange_rate', { precision: 10, scale: 4 }).notNull().default('1'),
  pkrEquivalent:   numeric('pkr_equivalent', { precision: 15, scale: 2 }).notNull(),
  date:            date('date').notNull(),
  reason:          text('reason'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const saleReturns = pgTable('sale_returns', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  serialNumber:  text('serial_number'),
  saleOrderId:   uuid('sale_order_id').references(() => salesOrders.id),
  customerId:    uuid('customer_id').notNull().references(() => tajirCustomers.id),
  stockItemId:   uuid('stock_item_id').notNull().references(() => inventoryLots.id),
  quantity:      numeric('quantity', { precision: 15, scale: 3 }).notNull(),
  rate:          numeric('rate', { precision: 15, scale: 2 }).notNull(),
  currencyCode:  char('currency_code', { length: 3 }).notNull().default('PKR'),
  exchangeRate:  numeric('exchange_rate', { precision: 10, scale: 4 }).notNull().default('1'),
  pkrEquivalent: numeric('pkr_equivalent', { precision: 15, scale: 2 }).notNull(),
  date:          date('date').notNull(),
  reason:        text('reason'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type PurchaseReturn    = typeof purchaseReturns.$inferSelect
export type NewPurchaseReturn = typeof purchaseReturns.$inferInsert
export type SaleReturn        = typeof saleReturns.$inferSelect
export type NewSaleReturn     = typeof saleReturns.$inferInsert
