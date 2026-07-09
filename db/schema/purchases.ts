import { pgTable, uuid, text, numeric, date, timestamp, char } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { inventoryLots } from './inventory'

export const suppliers = pgTable('suppliers', {
  id:                            uuid('id').primaryKey().defaultRandom(),
  tenantId:                      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:                          text('name').notNull(),
  openingBalance:                numeric('opening_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  openingBalanceCurrency:        char('opening_balance_currency', { length: 3 }).notNull().default('PKR'),
  openingBalancePkrEquivalent:   numeric('opening_balance_pkr_equivalent', { precision: 15, scale: 2 }).notNull().default('0'),
  createdAt:                     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const purchaseOrders = pgTable('purchase_orders', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  serialNumber:  text('serial_number'),
  supplierId:    uuid('supplier_id').notNull().references(() => suppliers.id),
  stockItemId:   uuid('stock_item_id').notNull().references(() => inventoryLots.id),
  quantity:      numeric('quantity', { precision: 15, scale: 3 }).notNull(),
  rate:          numeric('rate', { precision: 15, scale: 2 }).notNull(),
  currencyCode:  char('currency_code', { length: 3 }).notNull(),
  exchangeRate:  numeric('exchange_rate', { precision: 10, scale: 4 }).notNull().default('1'),
  pkrEquivalent: numeric('pkr_equivalent', { precision: 15, scale: 2 }).notNull(),
  advancePaid:   numeric('advance_paid', { precision: 15, scale: 2 }).notNull().default('0'),
  date:          date('date').notNull(),
  confirmedAt:   timestamp('confirmed_at', { withTimezone: true }),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const apPayments = pgTable('ap_payments', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  tenantId:           uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  serialNumber:       text('serial_number'),
  supplierId:         uuid('supplier_id').notNull().references(() => suppliers.id),
  amount:             numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currencyCode:       char('currency_code', { length: 3 }).notNull().default('PKR'),
  pkrEquivalent:      numeric('pkr_equivalent', { precision: 15, scale: 2 }).notNull(),
  paymentMethodNote:  text('payment_method_note'),
  date:               date('date').notNull(),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Supplier      = typeof suppliers.$inferSelect
export type NewSupplier   = typeof suppliers.$inferInsert
export type PurchaseOrder = typeof purchaseOrders.$inferSelect
export type ApPayment     = typeof apPayments.$inferSelect
