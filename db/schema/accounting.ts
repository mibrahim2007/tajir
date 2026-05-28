import { pgTable, uuid, text, varchar, numeric, date, timestamp, boolean, integer } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { tajirCustomers } from './sales'
import { suppliers } from './purchases'
import { inventoryLots } from './inventory'

export const chartOfAccounts = pgTable('chart_of_accounts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  code:        varchar('code', { length: 10 }).notNull(),
  name:        text('name').notNull(),
  accountType: text('account_type').notNull(),
  parentCode:  varchar('parent_code', { length: 10 }),
  isHeader:    boolean('is_header').notNull().default(false),
  isSystem:    boolean('is_system').notNull().default(false),
  systemKey:   text('system_key'),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const tenantCounters = pgTable('tenant_counters', {
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  counterName:  text('counter_name').notNull(),
  currentValue: integer('current_value').notNull().default(0),
})

export const journalEntries = pgTable('tajir_journal_entries', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  voucherNumber: text('voucher_number').notNull(),
  date:          date('date').notNull(),
  description:   text('description'),
  reference:     text('reference'),
  sourceType:    text('source_type').notNull().default('manual'),
  sourceId:      uuid('source_id'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const journalEntryLines = pgTable('tajir_journal_entry_lines', {
  id:             uuid('id').primaryKey().defaultRandom(),
  journalEntryId: uuid('journal_entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  accountId:      uuid('account_id').notNull().references(() => chartOfAccounts.id),
  description:    text('description'),
  debit:          numeric('debit', { precision: 15, scale: 2 }).notNull().default('0'),
  credit:         numeric('credit', { precision: 15, scale: 2 }).notNull().default('0'),
  customerId:     uuid('customer_id').references(() => tajirCustomers.id),
  supplierId:     uuid('supplier_id').references(() => suppliers.id),
  stockItemId:    uuid('stock_item_id').references(() => inventoryLots.id),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ChartOfAccount    = typeof chartOfAccounts.$inferSelect
export type JournalEntry      = typeof journalEntries.$inferSelect
export type JournalEntryLine  = typeof journalEntryLines.$inferSelect
