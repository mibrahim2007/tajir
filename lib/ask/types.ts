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

export type AskResponse = (AskTable | AskStats | AskText) & {
  /** Follow-up questions the user can tap. */
  suggestions?: string[]
}

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
  'Low stock items',
]
