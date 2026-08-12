# Triage reference — which layer absorbs which question

Paths are relative to `tajir/`.

## The engine's routing order

`runAsk()` in `lib/ask/engine.ts`, and mirrored by both check scripts. A question
is answered by the FIRST layer that claims it:

```
1. isInboxQuestion            → "check my email"
2. GUIDE_INDEX_KEYWORDS       → list of how-to topics
3. FAQ_INDEX_KEYWORDS         → browsable topic list
4. isComparativeQuestion + matchFaq   → concept, not steps
5. matchGuide()               → numbered steps
6. matchFaq()                 → concept answer
7. explicit search  ^(search|find|look for|show all|list all|talash) <term>$
8. disambiguation — a fragment matching ≥2 entity names lists them all
9. entity resolution (exact name, then fuzzy) + intent scoring
   NONENTITY_KEYWORDS +2 · SPECIFIC_KEYWORDS +3 · WHOLE_WORD_ALIASES +4
   entity+ledger +4/+5 · entity+summary +4 · bare name +2
10. fallback: unmatched → app/actions/ask.ts offers past questions + familyFor()
```

Static layers come first on purpose: "how to create a sale invoice" contains
words that would otherwise partial-match a party name and route to a ledger.

## Why `partial` never clears a backlog entry

`app/actions/ask.ts`:

```ts
const answered = await runAsk(effective)
let response = answered
if (answered.unmatched) response = suggestionAnswer(...) ?? answered
await logAskQuestion({ ..., response: answered })   // ← the ORIGINAL
```

`logAskQuestion` sets `answered: response.unmatched !== true`. A family offer or
a recall list leaves `unmatched: true` on the original, so the question is logged
as unanswered and reappears in the next export. That is deliberate — offering is
not answering — and it is why the triage script separates `partial` from `fixed`.

---

## Recipe: whole-word alias

**When** the question is one or two bare words that can only mean one report.

`lib/ask/intents.ts`:

```ts
export const WHOLE_WORD_ALIASES: Record<string, string[]> = {
  stock_summary: ['stock', 'stocks', 'inventory', ...],
  //             ^ add the exact word the user typed
}
```

- The key must be one of `RUNNER_IDS` — `ask-analysis-check.ts` asserts this.
- Matching is on the whole question after stripping `? . ! ,` and lowercasing, so
  "Stock?" and "  stock  " already work. Do not add punctuation variants.
- Never add a word that appears inside real questions unless it can only ever be
  the whole question. "customer" is safe (whole-question only); adding it to
  `NONENTITY_KEYWORDS` would break every question naming a customer.
- One word belongs to one intent. Duplicates across intents are a check failure.

**Regression case** in `scripts/ask-analysis-check.ts`:

```ts
const fromLog: [string, string][] = [
  ['cards', 'stock_summary'],       // add here
]
// and, in the "a named question still wins" block:
check('"stock of Ali Traders" is not an alias', aliasFor('stock of Ali Traders') === null)
```

## Recipe: intent family

**When** the word names an area and two or more reports could legitimately
answer. Offering beats guessing.

```ts
export const INTENT_FAMILIES: IntentFamily[] = [
  {
    id: 'period',
    cues: ['month', 'monthly', ...],       // word-boundary matched, longest wins
    title: 'Which month-wise view?',
    subtitle: 'Several reports break your business down by month',
    offers: [                              // phrased EXACTLY as the engine expects
      'Monthly sale comparison',
      'Monthly sales of <item name>',      // a placeholder is fine — it teaches the form
    ],
  },
]
```

- Every `offers` entry must itself be answerable. Verify by finding it in
  `ASK_EXAMPLES` / `ASK_HOWTO_EXAMPLES` in `lib/ask/types.ts`, or by tracing it
  through the keyword tables. `ask-analysis-check.ts` asserts this.
- Families are consulted **only after** the engine fails, so a cue inside a real
  question can never hijack it.
- Keep look-alike words with opposite meanings in separate families — "open"
  (unpaid invoices) and "opening" (setup balances) are the worked example.

**Remember**: a family alone leaves the entry `partial`. Prefer a real answer
where one is possible.

## Recipe: intent keyword

**When** it is a longer phrasing of a report that already exists.

```ts
export const NONENTITY_KEYWORDS: Record<string, string[]> = {
  monthly_sales: ['monthly sale', 'sales by month', 'show last month sale', ...],
}
```

- Substring-matched anywhere in the question, scored `+2`. So every entry must be
  a **phrase** that cannot appear inside an unrelated question.
- `SPECIFIC_KEYWORDS` scores `+3`; use it when a narrow intent must beat a broad
  one that also matches a bare word (`cheque_summary` vs `cheques`).
- If a more specific intent supersedes a general one, delete the general one in
  the engine rather than fighting it on score — see the `overdue`/`cheques` case.

**Regression case**: add a `data` row in `scripts/ask-routing-check.ts` so the
static layers are proven not to claim it first.

## Recipe: guide

**When** the question asks how to do something in the software.

`lib/ask/guides.ts`, and use the `ask-answer` skill for the writing standards.

```ts
{
  id: 'sale_invoice',
  title: '…',
  subtitle: '…',
  keywords: ['how do i start', ...],   // substrings of the lowered question
  intro: '…',
  steps: ['Sales → Invoices → New Invoice. …'],   // REAL screen labels
  notes: ['…'],                                    // consequences and gotchas
  links: [{ label: 'Invoices', href: '/invoices' }],
  related: ['…'],
}
```

Matching needs a how-to cue (`how to`, `how do i`, `kaise`, `tarika`, …) **or** a
keyword that is self-evidently instructional (starts `what is` / `how `, or
contains `concept` / `meaning`). Longest matching keyword wins, so a specific
entry beats a general one.

**Regression case** in `scripts/ask-routing-check.ts`: `['how do i start', 'guide:…']`.

## Recipe: FAQ

**When** the question asks what something is, why the app did something, or which
of two things to use.

```ts
{
  id: 'what_is_opening_balance',
  category: 'Getting started',          // must be in FAQ_CATEGORIES
  question: 'What is an opening balance?',
  keywords: [...],
  answer: '…',                          // ≤ 320 chars — the check enforces it
  points: ['…'],
  links: [...],
  related: ['…'],
}
```

- `id` unique, `category` valid, `keywords` non-empty, `answer` under 320
  characters — all four are asserted by `check:ask`.
- Comparative questions ("difference between X and Y") route to FAQs **before**
  guides. Give the comparison its own entry with a `difference between …` keyword.

**Regression case**: `['what is an opening balance', 'faq:what_is_opening_balance']`.

## Recipe: a report that does not exist

Some backlog entries are genuinely a missing feature — "employee", "location",
"comparision" of something the app does not compute. Do **not** invent a static
answer that pretends otherwise, and do not route it to a loosely related report.

Write it up instead:

- the question, and how many times it was asked
- the columns the answer would need
- the existing screen or report that shows the same figure, so the number can be
  reconciled (a query that silently double-counts a join produces a confident
  wrong number that no typecheck catches)
- whether an intent family can honestly cover it in the meantime

Then stop. Building the query is a product decision.
