// Deterministic guided-wizard state machine for the Playground demo generator.
//
// Runs entirely client-side — no external LLM. It walks a fixed sequence of
// questions, validates each answer, and answers side-questions from a built-in
// FAQ without losing its place. Only the final confirmation hands a complete
// DemoConfig back to the caller (which then calls the server action).

import { LIMITS, type DemoConfig } from './types'
import { resolveItemType } from './catalog'

export type BotMessage =
  | { kind: 'text'; body: string }
  | { kind: 'summary'; config: DemoConfig }

export type WizardState = {
  index: number                 // position in STEPS; === STEPS.length means confirm
  config: Partial<DemoConfig>
  awaitingConfirm: boolean
  done: boolean
}

export type AdvanceResult = {
  state: WizardState
  messages: BotMessage[]
  /** Set when the user confirmed — caller should run generation with this config. */
  generate?: DemoConfig
}

type ParseOk<T> = { ok: true; value: T }
type ParseErr = { ok: false; error: string }
type Parsed<T> = ParseOk<T> | ParseErr

type Step = {
  key: keyof DemoConfig
  ask: string
  help: string
  parse: (text: string) => Parsed<DemoConfig[keyof DemoConfig]>
}

// ── number parsing ─────────────────────────────────────────────────────────
// NB: no "a"/"an"/"no" here — those articles/particles appear in ordinary
// questions ("what is a location?") and must not be read as a number.
const WORDS: Record<string, number> = {
  zero: 0, none: 0, one: 1, single: 1, two: 2, couple: 2,
  three: 3, few: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, dozen: 12, fifteen: 15, twenty: 20,
}

function parseCount(min: number, max: number, label: string) {
  return (text: string): Parsed<number> => {
    const t = text.trim().toLowerCase()
    const digit = t.match(/-?\d+/)
    let n: number | undefined
    if (digit) n = parseInt(digit[0], 10)
    else {
      for (const [w, v] of Object.entries(WORDS)) {
        if (new RegExp(`\\b${w}\\b`).test(t)) { n = v; break }
      }
    }
    if (n === undefined || Number.isNaN(n)) {
      return { ok: false, error: `Please give me a number for ${label} (between ${min} and ${max}).` }
    }
    if (n < min) return { ok: false, error: `That's too low — ${label} must be at least ${min}.` }
    if (n > max) return { ok: false, error: `Let's keep it reasonable — I'll cap ${label} at ${max}. Enter ${min}–${max}.` }
    return { ok: true, value: n }
  }
}

function parseYesNo(text: string): Parsed<boolean> {
  const t = text.trim().toLowerCase()
  if (/^(y|yes|yeah|yep|sure|ok|okay|please|do)\b/.test(t)) return { ok: true, value: true }
  if (/^(n|no|nope|nah|don'?t|skip)\b/.test(t)) return { ok: true, value: false }
  return { ok: false, error: `Please answer yes or no.` }
}

function parseItemTypes(text: string): Parsed<string[]> {
  const parts = text
    .split(/[,;/]|\band\b|\n/i)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return { ok: false, error: `Name at least one item type, e.g. "Yarn, Fabric".` }
  const seen = new Set<string>()
  const types: string[] = []
  for (const p of parts) {
    const canonical = resolveItemType(p).name
    if (!seen.has(canonical.toLowerCase())) { seen.add(canonical.toLowerCase()); types.push(canonical) }
    if (types.length >= LIMITS.itemTypes) break
  }
  return { ok: true, value: types }
}

// ── the question sequence ──────────────────────────────────────────────────
const STEPS: Step[] = [
  {
    key: 'itemTypes',
    ask: `What kinds of items do you want to test with? List a few types separated by commas — e.g. **Yarn, Fabric, Electronics**.`,
    help: `Item types are top-level product categories. For each one you name I'll create a standard "1-level" item type and a handful of realistic sample items under it. You can use standard categories (Yarn, Fabric, Garments, Electronics, Grocery, Hardware, Cosmetics, Pharmacy, Stationery, Furniture, Services) or invent your own — anything works.`,
    parse: parseItemTypes as Step['parse'],
  },
  {
    key: 'itemsPerType',
    ask: `How many sample items should I create under **each** type? (1–${LIMITS.itemsPerType}, e.g. 4)`,
    help: `This many stock items are generated per type. So 3 types × 4 items = 12 items in total.`,
    parse: parseCount(1, LIMITS.itemsPerType, 'items per type') as Step['parse'],
  },
  {
    key: 'locations',
    ask: `How many store / warehouse **locations**? (0–${LIMITS.locations})`,
    help: `A location is a physical shop or warehouse where stock is held. Purchases add stock to a location; sales dispatch from one. Enter 0 to skip locations.`,
    parse: parseCount(0, LIMITS.locations, 'locations') as Step['parse'],
  },
  {
    key: 'suppliers',
    ask: `How many **suppliers**? (0–${LIMITS.suppliers})`,
    help: `Suppliers are the vendors you buy stock from. Demo purchase invoices are spread across them.`,
    parse: parseCount(0, LIMITS.suppliers, 'suppliers') as Step['parse'],
  },
  {
    key: 'customers',
    ask: `How many **customers**? (0–${LIMITS.customers})`,
    help: `Customers are who you sell to. Demo sale invoices are spread across them.`,
    parse: parseCount(0, LIMITS.customers, 'customers') as Step['parse'],
  },
  {
    key: 'employees',
    ask: `How many **employees**? (0–${LIMITS.employees})`,
    help: `Employees are staff records (with a designation and salary). They are not login accounts — that's the next question.`,
    parse: parseCount(0, LIMITS.employees, 'employees') as Step['parse'],
  },
  {
    key: 'users',
    ask: `How many additional **login users** (assistants)? These are **real accounts** with temporary passwords. (0–${LIMITS.users})`,
    help: `Each user is a genuine assistant login (created via the auth system) that can actually sign in with a temporary password I'll show you. They're recorded in the batch, so "Remove test data" deletes them too. Enter 0 if you don't need extra logins.`,
    parse: parseCount(0, LIMITS.users, 'users') as Step['parse'],
  },
  {
    key: 'days',
    ask: `Over how many **past days** should I spread the test sales & purchases? (0–${LIMITS.days}). Enter 0 for master data only — no transactions.`,
    help: `I first create purchase invoices to stock up your items, then sale invoices, dating them randomly across this many recent days so your reports and charts have history to show. Each invoice posts real journal entries. Enter 0 to generate only master data (items, parties) with no transactions.`,
    parse: parseCount(0, LIMITS.days, 'days') as Step['parse'],
  },
  {
    key: 'autoRemove',
    ask: `After you're done testing, should I flag this batch for easy cleanup? (**yes / no**) — either way you'll get a one-click "Remove test data" button.`,
    help: `Every row I create is tracked in a demo batch, so it can always be removed cleanly in one click. Saying yes just marks your intent to tidy up afterwards.`,
    parse: parseYesNo as Step['parse'],
  },
]

// ── FAQ (answered without advancing) ───────────────────────────────────────
const FAQ: { test: RegExp; answer: string }[] = [
  { test: /item type|categor/i, answer: `Item types are top-level product categories (Yarn, Electronics, …). I create one standard item type per name you give, plus a few sample items under each.` },
  { test: /\blocation|warehouse|store|branch/i, answer: `A location is a shop or warehouse that holds stock. Purchases add stock there; sales ship from it.` },
  { test: /supplier|vendor/i, answer: `Suppliers are vendors you buy from. Demo purchase invoices are distributed across them.` },
  { test: /customer|client|buyer/i, answer: `Customers are who you sell to. Demo sale invoices are distributed across them.` },
  { test: /employee|staff|worker/i, answer: `Employees are staff records with a designation and salary — not login accounts.` },
  { test: /user|login|account|password|sign ?in/i, answer: `Users are real assistant login accounts with temporary passwords you can actually use to sign in. They're removable with the rest of the batch.` },
  { test: /day|transaction|invoice|history|sale|purchase/i, answer: `The "days" number is how far back I spread generated purchase and sale invoices, so your reports have history. Each invoice posts proper journal entries and moves stock.` },
  { test: /remove|delete|clean|undo|revert/i, answer: `Everything is tracked in a demo batch. The Remove button deletes exactly those rows — invoices (with their journal entries & stock reversed), items, parties and users — in reverse order. Your real data is never touched.` },
  { test: /cost|price|money|charge|bill|real data|affect|safe/i, answer: `This only writes into your own tenant's tables using the standard app logic. It's free, and fully reversible via Remove. Still, use it on a test/demo tenant rather than live books.` },
  { test: /coa|chart of account|accounting|ledger|journal/i, answer: `If your Chart of Accounts isn't set up yet, I seed the standard one automatically before creating any invoices — otherwise the sales/purchases can't post.` },
  { test: /how (long|much time)|slow|fast/i, answer: `Generation runs server-side in dependency order. A few hundred rows take a few seconds; large day-ranges with many transactions take a little longer.` },
]

function isQuestionLike(text: string): boolean {
  const t = text.trim().toLowerCase()
  return /\?$/.test(t) || /^(what|why|how|which|who|when|whats|what's|can |could |do |does |is |are |should |explain|tell me|help)/.test(t)
}

function faqAnswer(text: string, fallback: string): string {
  for (const f of FAQ) if (f.test.test(text)) return f.answer
  return fallback
}

function ask(step: Step): BotMessage {
  return { kind: 'text', body: step.ask }
}

function completeConfig(config: Partial<DemoConfig>): DemoConfig {
  return {
    itemTypes: config.itemTypes ?? [],
    itemsPerType: config.itemsPerType ?? 4,
    locations: config.locations ?? 0,
    suppliers: config.suppliers ?? 0,
    customers: config.customers ?? 0,
    employees: config.employees ?? 0,
    users: config.users ?? 0,
    days: config.days ?? 0,
    autoRemove: config.autoRemove ?? false,
  }
}

/** Greeting + the first question. */
export function startWizard(): { state: WizardState; messages: BotMessage[] } {
  return {
    state: { index: 0, config: {}, awaitingConfirm: false, done: false },
    messages: [
      { kind: 'text', body: `👋 Welcome to the **Demo Data Playground**. I'll ask a few quick questions, then generate a full set of realistic test data you can explore — and remove in one click whenever you like.\n\nAsk me anything along the way (type "restart" to start over).` },
      ask(STEPS[0]),
    ],
  }
}

/** Advance the wizard by one user message. */
export function advance(state: WizardState, userText: string): AdvanceResult {
  const text = userText.trim()

  if (/^(restart|start over|reset|begin again)\b/i.test(text)) {
    const s = startWizard()
    return { state: s.state, messages: [{ kind: 'text', body: `Sure — starting over.` }, ...s.messages.slice(1)] }
  }

  // ── confirmation phase ──
  if (state.awaitingConfirm) {
    if (/^(generate|create|go|yes|proceed|confirm|do it|make it|start)\b/i.test(text)) {
      const config = completeConfig(state.config)
      return {
        state: { ...state, done: true },
        messages: [{ kind: 'text', body: `🚀 Generating your demo data now — this can take a few seconds…` }],
        generate: config,
      }
    }
    // Let the user jump back to edit a specific answer.
    const jump = STEPS.findIndex((s) => new RegExp(s.key.replace(/([A-Z])/g, ' ?$1'), 'i').test(text))
    if (/change|edit|no\b|wrong/i.test(text) || jump >= 0) {
      const idx = jump >= 0 ? jump : 0
      return {
        state: { ...state, index: idx, awaitingConfirm: false },
        messages: [{ kind: 'text', body: `No problem, let's update that.` }, ask(STEPS[idx])],
      }
    }
    if (isQuestionLike(text)) {
      return { state, messages: [{ kind: 'text', body: faqAnswer(text, `When you're ready, type **generate**, or **change <field>** to edit an answer.`) }] }
    }
    return { state, messages: [{ kind: 'text', body: `Type **generate** to create it, **change <field>** to edit (e.g. "change customers"), or **restart**.` }] }
  }

  // ── question phase ──
  const step = STEPS[state.index]

  // A question at any step is answered from the FAQ without advancing. Checked
  // BEFORE parsing so the article in "what is a location?" can't be misread as a
  // number, and so free-text steps (item types) never swallow a question.
  if (isQuestionLike(text)) {
    return { state, messages: [{ kind: 'text', body: faqAnswer(text, step.help) }, ask(step)] }
  }

  const parsed = step.parse(text)
  if (!parsed.ok) {
    return { state, messages: [{ kind: 'text', body: parsed.error }, ask(step)] }
  }

  const config = { ...state.config, [step.key]: parsed.value }
  const nextIndex = state.index + 1

  // Confirmation for the item-types step echoes what was recognised.
  const ack: BotMessage[] =
    step.key === 'itemTypes'
      ? [{ kind: 'text', body: `Got it — ${(parsed.value as string[]).length} type(s): ${(parsed.value as string[]).join(', ')}.` }]
      : []

  if (nextIndex < STEPS.length) {
    return { state: { ...state, index: nextIndex, config }, messages: [...ack, ask(STEPS[nextIndex])] }
  }

  // Reached the end → show summary and await confirmation.
  return {
    state: { ...state, index: nextIndex, config, awaitingConfirm: true },
    messages: [
      ...ack,
      { kind: 'text', body: `Here's what I'll create:` },
      { kind: 'summary', config: completeConfig(config) },
      { kind: 'text', body: `Type **generate** to build it, or **change <field>** to adjust anything.` },
    ],
  }
}
