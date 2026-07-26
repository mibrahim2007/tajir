// Shared response shapes for the Ask page. Kept free of server imports so the
// client chat component can render them.

export type AskColumnKind = 'text' | 'money' | 'number' | 'qty' | 'date'

export type AskColumn = {
  key: string
  label: string
  kind?: AskColumnKind      // drives client-side formatting + alignment
}

export type AskTable = {
  kind: 'table'
  title: string
  subtitle?: string
  columns: AskColumn[]
  rows: Record<string, string | number | null>[]
  summary?: string          // one-line takeaway above the table
  footer?: string           // e.g. a total line
}

export type AskStat = { label: string; value: string; tone?: 'default' | 'positive' | 'negative' }

export type AskStats = {
  kind: 'stats'
  title: string
  subtitle?: string
  stats: AskStat[]
  summary?: string
}

export type AskText = {
  kind: 'text'
  title?: string
  body: string
}

/** A how-to / concept answer: numbered steps, caveats, and links to the screen. */
export type AskGuide = {
  kind: 'guide'
  title: string
  subtitle?: string
  intro?: string
  steps: string[]
  notes?: string[]
  links?: { label: string; href: string }[]
}

export type AskResponse = (AskTable | AskStats | AskText | AskGuide) & {
  /** Follow-up questions the user can tap. */
  suggestions?: string[]
}

/** How-to prompts, shown alongside the data ones on an empty page. */
export const ASK_HOWTO_EXAMPLES = [
  'How to load customer opening balances',
  'How to load supplier opening balances',
  'How to load opening stock location wise',
  'How to create a sale invoice',
  'How to create a purchase order',
  'How to create a sale return',
  'How to create a purchase return',
  'What is PDC',
  'Employee loans and advances',
]

/** Prompts shown on an empty page and offered as follow-ups. */
export const ASK_EXAMPLES = [
  'Show me the ledger of ',
  'Business summary of ',
  'Item ledger for ',
  'Slow moving items',
  'Slow / inactive customers',
  'Top customers',
  'Who owes me money',
  'Who do I owe',
  'Stock summary',
  'What is overdue',
  'Low stock items',
  'Pending cheques',
  'Overdue cheques',
  'Cheque summary',
]
