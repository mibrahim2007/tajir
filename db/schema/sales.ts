import { pgTable, uuid, text, numeric, date, timestamp, char, boolean, integer } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { inventoryLots } from './inventory'

export const tajirCustomers = pgTable('tajir_customers', {
  id:                           uuid('id').primaryKey().defaultRandom(),
  tenantId:                     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:                         text('name').notNull(),
  openingBalance:               numeric('opening_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  openingBalanceCurrency:       char('opening_balance_currency', { length: 3 }).notNull().default('PKR'),
  openingBalancePkrEquivalent:  numeric('opening_balance_pkr_equivalent', { precision: 15, scale: 2 }).notNull().default('0'),
  createdAt:                    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const salesOrders = pgTable('sales_orders', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  serialNumber:   text('serial_number'),
  customerId:     uuid('customer_id').notNull().references(() => tajirCustomers.id),
  stockItemId:    uuid('stock_item_id').notNull().references(() => inventoryLots.id),
  quantity:       numeric('quantity', { precision: 15, scale: 3 }).notNull(),
  rate:           numeric('rate', { precision: 15, scale: 2 }).notNull(),
  currencyCode:   char('currency_code', { length: 3 }).notNull(),
  exchangeRate:   numeric('exchange_rate', { precision: 10, scale: 4 }).notNull().default('1'),
  pkrEquivalent:  numeric('pkr_equivalent', { precision: 15, scale: 2 }).notNull(),
  date:           date('date').notNull(),
  paymentDueDate: date('payment_due_date'),
  // Payment terms in days; when set, payment_due_date = date + due_days.
  dueDays:        integer('due_days'),
  notes:          text('notes'),
  confirmedAt:    timestamp('confirmed_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const arReceipts = pgTable('ar_receipts', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  tenantId:           uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  serialNumber:       text('serial_number'),
  customerId:         uuid('customer_id').notNull().references(() => tajirCustomers.id),
  amount:             numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currencyCode:       char('currency_code', { length: 3 }).notNull().default('PKR'),
  pkrEquivalent:      numeric('pkr_equivalent', { precision: 15, scale: 2 }).notNull(),
  paymentMethodNote:  text('payment_method_note'),
  date:               date('date').notNull(),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const customerPriceLists = pgTable('customer_price_lists', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId:    uuid('customer_id').notNull().references(() => tajirCustomers.id),
  stockItemId:   uuid('stock_item_id').notNull().references(() => inventoryLots.id),
  rate:          numeric('rate', { precision: 15, scale: 2 }).notNull(),
  isActive:      boolean('is_active').notNull().default(true),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  supersededAt:  timestamp('superseded_at', { withTimezone: true }),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TajirCustomer    = typeof tajirCustomers.$inferSelect
export type SalesOrder       = typeof salesOrders.$inferSelect
export type ArReceipt        = typeof arReceipts.$inferSelect
export type CustomerPriceList = typeof customerPriceLists.$inferSelect
