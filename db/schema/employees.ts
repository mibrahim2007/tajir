import { pgTable, uuid, text, numeric, date, integer, boolean, timestamp, char } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

// NOTE: `banks` and the tender-line tables live only in SQL migrations (the app
// reads them via the raw Supabase client), so bank_id is a plain uuid column
// here — the real FK is enforced in migration 0026, mirroring ar_receipt_lines.

export const employees = pgTable('employees', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:          text('name').notNull(),
  employeeCode:  text('employee_code'),
  phone:         text('phone'),
  cnic:          text('cnic'),
  designation:   text('designation'),
  monthlySalary: numeric('monthly_salary', { precision: 15, scale: 2 }).notNull().default('0'),
  isActive:      boolean('is_active').notNull().default(true),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const employeeLoans = pgTable('employee_loans', {
  id:                uuid('id').primaryKey().defaultRandom(),
  tenantId:          uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  serialNumber:      text('serial_number'),
  employeeId:        uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  principal:         numeric('principal', { precision: 15, scale: 2 }).notNull(),
  currencyCode:      char('currency_code', { length: 3 }).notNull().default('PKR'),
  exchangeRate:      numeric('exchange_rate', { precision: 10, scale: 4 }).notNull().default('1'),
  pkrEquivalent:     numeric('pkr_equivalent', { precision: 15, scale: 2 }).notNull(),
  disbursementDate:  date('disbursement_date').notNull(),
  installmentCount:  integer('installment_count'),
  installmentAmount: numeric('installment_amount', { precision: 15, scale: 2 }),
  firstDueDate:      date('first_due_date'),
  frequency:         text('frequency').notNull().default('monthly'),
  status:            text('status').notNull().default('active'),
  notes:             text('notes'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const loanInstallments = pgTable('loan_installments', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  loanId:        uuid('loan_id').notNull().references(() => employeeLoans.id, { onDelete: 'cascade' }),
  installmentNo: integer('installment_no').notNull(),
  dueDate:       date('due_date').notNull(),
  amount:        numeric('amount', { precision: 15, scale: 2 }).notNull(),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const loanRepayments = pgTable('loan_repayments', {
  id:                uuid('id').primaryKey().defaultRandom(),
  tenantId:          uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  serialNumber:      text('serial_number'),
  employeeId:        uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  loanId:            uuid('loan_id').references(() => employeeLoans.id, { onDelete: 'set null' }),
  amount:            numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currencyCode:      char('currency_code', { length: 3 }).notNull().default('PKR'),
  exchangeRate:      numeric('exchange_rate', { precision: 10, scale: 4 }).notNull().default('1'),
  pkrEquivalent:     numeric('pkr_equivalent', { precision: 15, scale: 2 }).notNull(),
  paymentMethodNote: text('payment_method_note'),
  date:              date('date').notNull(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const loanDisbursementLines = pgTable('loan_disbursement_lines', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  loanId:          uuid('loan_id').notNull().references(() => employeeLoans.id, { onDelete: 'cascade' }),
  lineNo:          integer('line_no').notNull().default(1),
  transactionType: text('transaction_type').notNull(),
  chequeNumber:    text('cheque_number'),
  bankId:          uuid('bank_id'),
  amount:          numeric('amount', { precision: 15, scale: 2 }).notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const loanRepaymentLines = pgTable('loan_repayment_lines', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  repaymentId:     uuid('repayment_id').notNull().references(() => loanRepayments.id, { onDelete: 'cascade' }),
  lineNo:          integer('line_no').notNull().default(1),
  transactionType: text('transaction_type').notNull(),
  chequeNumber:    text('cheque_number'),
  bankId:          uuid('bank_id'),
  amount:          numeric('amount', { precision: 15, scale: 2 }).notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Employee              = typeof employees.$inferSelect
export type NewEmployee           = typeof employees.$inferInsert
export type EmployeeLoan          = typeof employeeLoans.$inferSelect
export type LoanInstallment       = typeof loanInstallments.$inferSelect
export type LoanRepayment         = typeof loanRepayments.$inferSelect
export type LoanDisbursementLine  = typeof loanDisbursementLines.$inferSelect
export type LoanRepaymentLine     = typeof loanRepaymentLines.$inferSelect
