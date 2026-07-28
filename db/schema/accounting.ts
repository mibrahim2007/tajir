import { pgTable, uuid, text, varchar, numeric, date, timestamp, boolean, integer, char } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { tajirCustomers } from './sales'
import { suppliers, purchaseOrders } from './purchases'
import { inventoryLots } from './inventory'
import { salesOrders } from './sales'
import { employees } from './employees'

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
  employeeId:     uuid('employee_id').references(() => employees.id),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const debitNotes = pgTable('debit_notes', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  supplierId:      uuid('supplier_id').notNull().references(() => suppliers.id),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
  amount:          numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currencyCode:    char('currency_code', { length: 3 }).notNull().default('PKR'),
  exchangeRate:    numeric('exchange_rate', { precision: 10, scale: 4 }).notNull().default('1'),
  pkrEquivalent:   numeric('pkr_equivalent', { precision: 15, scale: 2 }).notNull(),
  date:            date('date').notNull(),
  reason:          text('reason'),
  reference:       text('reference'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const creditNotes = pgTable('credit_notes', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId:   uuid('customer_id').notNull().references(() => tajirCustomers.id),
  saleOrderId:  uuid('sale_order_id').references(() => salesOrders.id),
  amount:       numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currencyCode: char('currency_code', { length: 3 }).notNull().default('PKR'),
  exchangeRate: numeric('exchange_rate', { precision: 10, scale: 4 }).notNull().default('1'),
  pkrEquivalent: numeric('pkr_equivalent', { precision: 15, scale: 2 }).notNull(),
  date:         date('date').notNull(),
  reason:       text('reason'),
  reference:    text('reference'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// --- Custom financial report builder (migration 0053) -----------------------
//
// A layout definition only — no amounts are stored. Figures are computed at
// view time from the journal by lib/reports/custom-report.ts.

export const customReports = pgTable('custom_reports', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:         text('name').notNull(),
  description:  text('description'),
  /** 'period' = movement between two dates; 'as_of' = cumulative to one date. */
  basis:        text('basis').notNull().default('period'),
  hideZeroRows: boolean('hide_zero_rows').notNull().default(true),
  isActive:     boolean('is_active').notNull().default(true),
  createdBy:    uuid('created_by'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const customReportLines = pgTable('custom_report_lines', {
  id:              uuid('id').primaryKey().defaultRandom(),
  reportId:        uuid('report_id').notNull().references(() => customReports.id, { onDelete: 'cascade' }),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  sortOrder:       integer('sort_order').notNull().default(0),
  /** 'header' | 'accounts' | 'subtotal' | 'spacer' */
  lineType:        text('line_type').notNull(),
  label:           text('label').notNull().default(''),
  /** Short handle a subtotal formula can name this line by. */
  ref:             text('ref'),
  indent:          integer('indent').notNull().default(0),
  /** 'natural' (debit positive) | 'credit_positive' (sign flipped). */
  sign:            text('sign').notNull().default('natural'),
  includeChildren: boolean('include_children').notNull().default(true),
  showDetail:      boolean('show_detail').notNull().default(false),
  isBold:          boolean('is_bold').notNull().default(false),
  underline:       boolean('underline').notNull().default(false),
  formula:         text('formula'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const customReportLineAccounts = pgTable('custom_report_line_accounts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  lineId:      uuid('line_id').notNull().references(() => customReportLines.id, { onDelete: 'cascade' }),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  accountCode: varchar('account_code', { length: 10 }).notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ChartOfAccount    = typeof chartOfAccounts.$inferSelect
export type JournalEntry      = typeof journalEntries.$inferSelect
export type JournalEntryLine  = typeof journalEntryLines.$inferSelect
export type DebitNote         = typeof debitNotes.$inferSelect
export type NewDebitNote      = typeof debitNotes.$inferInsert
export type CreditNote        = typeof creditNotes.$inferSelect
export type NewCreditNote     = typeof creditNotes.$inferInsert
export type CustomReport            = typeof customReports.$inferSelect
export type CustomReportLine        = typeof customReportLines.$inferSelect
export type CustomReportLineAccount = typeof customReportLineAccounts.$inferSelect
