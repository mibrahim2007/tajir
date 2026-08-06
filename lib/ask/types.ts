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

/** A plain-language answer to a newcomer question: answer first, then detail. */
export type AskFaq = {
  kind: 'faq'
  title: string
  category?: string
  answer: string
  points?: string[]
  links?: { label: string; href: string }[]
}

/** A browsable list of question topics, grouped. */
export type AskTopics = {
  kind: 'topics'
  title: string
  subtitle?: string
  groups: { category: string; questions: string[] }[]
}

/**
 * The one party a data answer is about, when it is about exactly one — set on
 * ledgers and business summaries. It lets the "email this answer" dialog offer
 * to send a customer their own statement, without the browser ever choosing a
 * recipient address: the action looks the address up again server-side.
 */
export type AskParty = {
  type: 'customer' | 'supplier'
  id: string
  name: string
  /** null when no address is on file — the option is shown but disabled. */
  email: string | null
}

export type AskResponse = (AskTable | AskStats | AskText | AskGuide | AskFaq | AskTopics) & {
  /** Follow-up questions the user can tap. */
  suggestions?: string[]
  /** Present only on answers built from stored data about a single party. */
  party?: AskParty
  /**
   * Set when the answer was produced by a typed "email me …" command and has
   * already been sent, so the chat can show a confirmation above it.
   */
  emailed?: { to: string[]; failed?: string }
  /**
   * The question actually answered. Differs from what the user typed only when
   * an "email me …" directive was stripped off the front — the chat keeps this
   * one, so pressing "Email this answer" later re-runs the query, not the
   * directive.
   */
  asked?: string
  /**
   * Set by the engine's own fallbacks — nothing matched, so this is the generic
   * help answer rather than a real one. It is what tells the history layer a
   * question is worth trying to recall, and stops unanswered questions being
   * offered back as suggestions later.
   */
  unmatched?: boolean
}

/**
 * Only tabular and stat answers carry data worth emailing — a how-to guide or
 * an FAQ is the same for every tenant and is already on screen.
 */
export function isEmailable(r: AskResponse): boolean {
  return r.kind === 'table' || r.kind === 'stats'
}

/** Starter questions for someone who has just been given a login. */
export const ASK_NEWCOMER_EXAMPLES = [
  'I am new — where do I start?',
  'What is an opening balance?',
  'Do I need to know accounting?',
  'What is a location and do I need one?',
  'Common questions',
]

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
