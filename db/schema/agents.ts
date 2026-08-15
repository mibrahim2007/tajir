import { pgTable, uuid, text, numeric, date, timestamp, boolean, integer, char } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

// An agent (broker / arhti) introduces trade on both sides of the book and is
// paid commission for it, so they are a PAYABLE party — see migration 0058 for
// the GL treatment. Sale and purchase commission are configured independently
// because the same broker is commonly paid on a different basis for each.

export const agents = pgTable('agents', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:       text('name').notNull(),
  agentCode:  text('agent_code'),
  cnic:       text('cnic'),
  phone:      text('phone'),
  email:      text('email'),
  city:       text('city'),
  address:    text('address'),

  /** 'percentage' | 'per_unit' | 'flat' | 'none' */
  saleCommissionType:     text('sale_commission_type').notNull().default('percentage'),
  saleCommissionRate:     numeric('sale_commission_rate', { precision: 15, scale: 4 }).notNull().default('0'),
  purchaseCommissionType: text('purchase_commission_type').notNull().default('percentage'),
  purchaseCommissionRate: numeric('purchase_commission_rate', { precision: 15, scale: 4 }).notNull().default('0'),

  openingBalance:              numeric('opening_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  openingBalanceCurrency:      char('opening_balance_currency', { length: 3 }).notNull().default('PKR'),
  openingBalancePkrEquivalent: numeric('opening_balance_pkr_equivalent', { precision: 15, scale: 2 }).notNull().default('0'),

  isActive:   boolean('is_active').notNull().default(true),
  notes:      text('notes'),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// One accrual row per source document (unique on tenant + source_type +
// source_id), holding the basis and the rate in force when it was posted so a
// later change to the agent's default rate never restates history.
export const agentCommissions = pgTable('agent_commissions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  agentId:        uuid('agent_id').notNull().references(() => agents.id),
  /** 'sale_invoice' | 'purchase_invoice' */
  sourceType:     text('source_type').notNull(),
  sourceId:       uuid('source_id').notNull(),
  documentSerial: text('document_serial'),
  partyName:      text('party_name'),
  baseAmount:     numeric('base_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  baseQuantity:   numeric('base_quantity', { precision: 15, scale: 3 }).notNull().default('0'),
  commissionType: text('commission_type').notNull(),
  commissionRate: numeric('commission_rate', { precision: 15, scale: 4 }).notNull().default('0'),
  amount:         numeric('amount', { precision: 15, scale: 2 }).notNull(),
  date:           date('date').notNull(),
  notes:          text('notes'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const agentPayments = pgTable('agent_payments', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  serialNumber:  text('serial_number'),
  agentId:       uuid('agent_id').notNull().references(() => agents.id),
  amount:        numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currencyCode:  char('currency_code', { length: 3 }).notNull().default('PKR'),
  exchangeRate:  numeric('exchange_rate', { precision: 10, scale: 4 }).notNull().default('1'),
  pkrEquivalent: numeric('pkr_equivalent', { precision: 15, scale: 2 }).notNull(),
  date:          date('date').notNull(),
  notes:         text('notes'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// NOTE: `banks` lives only in SQL migrations (the app reads it via the raw
// Supabase client), so bank_id is a plain uuid here — the real FK is enforced
// in migration 0058, mirroring owner_transaction_lines.
export const agentPaymentLines = pgTable('agent_payment_lines', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  paymentId:       uuid('payment_id').notNull().references(() => agentPayments.id, { onDelete: 'cascade' }),
  lineNo:          integer('line_no').notNull().default(1),
  transactionType: text('transaction_type').notNull(),
  chequeNumber:    text('cheque_number'),
  chequeDueDate:   date('cheque_due_date'),
  bankId:          uuid('bank_id'),
  amount:          numeric('amount', { precision: 15, scale: 2 }).notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Agent              = typeof agents.$inferSelect
export type NewAgent           = typeof agents.$inferInsert
export type AgentCommission    = typeof agentCommissions.$inferSelect
export type AgentPayment       = typeof agentPayments.$inferSelect
export type AgentPaymentLine   = typeof agentPaymentLines.$inferSelect
