import type { Basis, LineType, Sign } from './custom-report'

// Starter layouts offered when creating a custom report.
//
// They mirror the built-in statements using the standard Pakistani CoA code
// ranges the seed installs (4xxx revenue, 5xxx cost of sales, 6xxx operating,
// 7xxx financial charges; 1xxx assets, 2xxx liabilities, 3xxx equity). Every
// line rolls children up, so a template keeps working after new sub-accounts
// are added — and each is fully editable once created.

export type TemplateLine = {
  lineType: LineType
  label: string
  ref?: string
  indent?: number
  sign?: Sign
  includeChildren?: boolean
  showDetail?: boolean
  isBold?: boolean
  underline?: boolean
  formula?: string
  accountCodes?: string[]
}

export type ReportTemplate = {
  key: string
  name: string
  description: string
  basis: Basis
  hideZeroRows: boolean
  lines: TemplateLine[]
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    key: 'blank',
    name: 'Blank',
    description: 'Start with an empty layout and add your own headers.',
    basis: 'period',
    hideZeroRows: true,
    lines: [
      { lineType: 'header', label: 'Section', isBold: true },
      { lineType: 'accounts', label: 'New reporting header', ref: 'A', indent: 1, showDetail: true },
    ],
  },
  {
    key: 'profit_loss',
    name: 'Profit & Loss',
    description: 'Revenue less cost of sales, operating expenses and financial charges.',
    basis: 'period',
    hideZeroRows: true,
    lines: [
      { lineType: 'header', label: 'REVENUE' },
      { lineType: 'accounts', label: 'Sales Revenue', ref: 'REV', indent: 1, sign: 'credit_positive', showDetail: true, accountCodes: ['4000'] },
      { lineType: 'spacer', label: '' },
      { lineType: 'header', label: 'COST OF SALES' },
      { lineType: 'accounts', label: 'Cost of Sales', ref: 'COGS', indent: 1, showDetail: true, accountCodes: ['5000'] },
      { lineType: 'subtotal', label: 'Gross Profit', ref: 'GP', formula: 'REV - COGS', isBold: true, underline: true },
      { lineType: 'spacer', label: '' },
      { lineType: 'header', label: 'OPERATING EXPENSES' },
      { lineType: 'accounts', label: 'Operating Expenses', ref: 'OPEX', indent: 1, showDetail: true, accountCodes: ['6000'] },
      { lineType: 'subtotal', label: 'Operating Profit', ref: 'OP', formula: 'GP - OPEX', isBold: true, underline: true },
      { lineType: 'spacer', label: '' },
      { lineType: 'header', label: 'FINANCIAL CHARGES' },
      { lineType: 'accounts', label: 'Financial Charges', ref: 'FIN', indent: 1, showDetail: true, accountCodes: ['7000'] },
      { lineType: 'subtotal', label: 'Net Profit', ref: 'NP', formula: 'OP - FIN', isBold: true, underline: true },
    ],
  },
  {
    key: 'balance_sheet',
    name: 'Balance Sheet',
    description: 'Assets against liabilities and equity, cumulative to a date.',
    basis: 'as_of',
    hideZeroRows: true,
    lines: [
      { lineType: 'header', label: 'ASSETS' },
      { lineType: 'accounts', label: 'Assets', ref: 'ASSETS', indent: 1, showDetail: true, accountCodes: ['1000'] },
      { lineType: 'subtotal', label: 'Total Assets', ref: 'TA', formula: 'ASSETS', isBold: true, underline: true },
      { lineType: 'spacer', label: '' },
      { lineType: 'header', label: 'LIABILITIES' },
      { lineType: 'accounts', label: 'Liabilities', ref: 'LIAB', indent: 1, sign: 'credit_positive', showDetail: true, accountCodes: ['2000'] },
      { lineType: 'spacer', label: '' },
      { lineType: 'header', label: 'EQUITY' },
      { lineType: 'accounts', label: 'Capital & Reserves', ref: 'EQ', indent: 1, sign: 'credit_positive', showDetail: true, accountCodes: ['3000'] },
      { lineType: 'accounts', label: 'Profit for the period', ref: 'NP', indent: 1, sign: 'credit_positive', accountCodes: ['4000', '5000', '6000', '7000'] },
      { lineType: 'subtotal', label: 'Total Liabilities & Equity', ref: 'TLE', formula: 'LIAB + EQ + NP', isBold: true, underline: true },
    ],
  },
  {
    key: 'expense_summary',
    name: 'Expense Summary',
    description: 'Every expense head for the period, with account-level detail.',
    basis: 'period',
    hideZeroRows: true,
    lines: [
      { lineType: 'header', label: 'EXPENSES' },
      { lineType: 'accounts', label: 'Cost of Sales', ref: 'COGS', indent: 1, showDetail: true, accountCodes: ['5000'] },
      { lineType: 'accounts', label: 'Operating Expenses', ref: 'OPEX', indent: 1, showDetail: true, accountCodes: ['6000'] },
      { lineType: 'accounts', label: 'Financial Charges', ref: 'FIN', indent: 1, showDetail: true, accountCodes: ['7000'] },
      { lineType: 'subtotal', label: 'Total Expenses', ref: 'TOT', formula: 'COGS + OPEX + FIN', isBold: true, underline: true },
    ],
  },
]
