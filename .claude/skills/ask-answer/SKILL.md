---
name: ask-answer
description: Write or edit the Ask chatbot's hand-written answers — FAQ entries, how-to guides, intent keywords, whole-word aliases and intent families in tajir/lib/ask. Use when adding or fixing Ask content, when a guide has drifted from the screen it describes, when a question routes to the wrong answer, or when the ask-backlog skill needs an answer authored. Carries the house standards for voice, keywords, screen labels, links and regression cases.
---

# Writing an Ask answer

Ask's static layers are the whole reason the feature can exist without a language
model: every explanatory sentence is text a human wrote and committed. That only
holds if the text is right. **A guide that has drifted from its screen is worse
than no guide** — it is confidently wrong, and its being wrong is invisible.

Work from `tajir/`. Files: `lib/ask/faq.ts`, `lib/ask/guides.ts`,
`lib/ask/intents.ts`, `lib/ask/types.ts`.

## Before writing: verify against the actual screen

Never write a step from memory or from another guide. For each screen a step
names, open the component and read the real labels:

```bash
ls "app/(app)"                                    # the real routes
grep -rn "Opening Balance" "app/(app)/customers" components | head
```

The route list is the source of truth for `links` — `href: '/customers'` is valid
because `app/(app)/customers` exists. A link to a route that does not exist is a
dead end inside an answer that claims to be authoritative.

If you cannot verify a label, say so and leave the step out. An incomplete guide
is recoverable; a wrong one is not.

## Voice

Assume the reader was handed a login this morning and has never used software
like this. Plain language, no jargon, no accounting vocabulary that is not
immediately explained.

- **Answer first.** The first sentence answers the question; detail follows in
  `points` or `notes`. Do not build up to it.
- **Give the consequence, not just the click path.** "A negative figure means the
  customer has already paid you in advance." "This only sets the subledger; for
  the Balance Sheet to agree you must also set the opening balance on 1130."
  The consequence is the part the user could not have worked out themselves.
- **Name the real thing.** "Sales → Customers, then the pencil on their row" —
  not "navigate to the customer edit screen".
- Sentences, not fragments. No exclamation marks, no encouragement, no "simply".

## FAQ entries — `lib/ask/faq.ts`

```ts
{
  id: 'unique_snake_case',
  category: 'Getting started',       // must be one of FAQ_CATEGORIES
  question: 'What is an opening balance?',   // shown as the answer's title
  keywords: ['opening balance', 'purana balance', ...],
  answer: 'One or two sentences that answer it directly.',   // ≤ 320 characters
  points: ['Supporting detail, only where it earns its place.'],
  links: [{ label: 'Customers', href: '/customers' }],
  related: ['Another question Ask can actually answer'],
}
```

`check:ask` enforces: unique `id`, valid `category`, non-empty `keywords`, answer
under 320 characters. Target ~30–40 FAQs across the seven categories.

Every `related` entry must be a question Ask answers — it is rendered as a
tappable chip, and a chip that leads to the generic help card is a broken
promise. Verify each one against `ASK_EXAMPLES` / `ASK_HOWTO_EXAMPLES` in
`lib/ask/types.ts`, or by tracing the keyword tables.

## Guides — `lib/ask/guides.ts`

```ts
{
  id: 'unique_snake_case',
  title: 'Loading customer opening balances',
  subtitle: 'What each customer already owed you on the day you started',
  keywords: [...],
  intro: 'One line of context, including any access restriction.',
  steps: ['Imperative, one action each, naming the REAL labels.'],
  notes: ['Caveats, gotchas, accounting consequences.'],
  links: [{ label: 'Customers', href: '/customers' }],
  related: [...],
}
```

Steps are imperative and self-contained. Mention the bulk path where one exists
("Doing many at once? Settings → Opening Balances …") — it is the step people
most often do not know about. Target ~9–12 guides.

## Keywords — the part that decides whether anyone sees your answer

This is where most Ask bugs live. Three separate mechanisms, and using the wrong
one breaks unrelated questions:

| Mechanism | Matching | Use for |
| --- | --- | --- |
| `keywords` on a Guide/Faq | substring of the lowered question, **longest wins**, needs a cue | how-to and concept phrasings |
| `NONENTITY_KEYWORDS` / `SPECIFIC_KEYWORDS` | substring anywhere, `+2` / `+3` | phrases naming an existing report |
| `WHOLE_WORD_ALIASES` | the whole question only, `+4` | single bare words |

Rules:

- **A topic keyword alone must not trigger a static answer.** A guide or FAQ
  matches only when the question carries an explicit cue (`how to`, `what is`,
  `difference between`, `kaise`, `kya hai`, …) or the keyword is self-evidently a
  question (starts `what is` / `how `, contains `difference between` / ` vs `).
  This is what stops "sale invoice of Ali Traders" returning instructions.
- **Longest matching keyword wins**, so add the specific phrasing
  ("customer opening balance") as well as the general one ("opening balance") and
  let precedence sort them.
- **Never put a bare word in `NONENTITY_KEYWORDS`.** It matches as a substring:
  `'ledger'` there would hijack "ledger of Ali Traders". Bare words go in
  `WHOLE_WORD_ALIASES`, which fires only on the whole question.
- **Take phrasings from the log, not from your imagination.** The question a user
  typed — including the typo — is the keyword worth adding. `comparision` is in
  `INTENT_FAMILIES` because someone typed it.
- **Carry the Roman-Urdu variants** the users mix in: `kaise`, `kese`, `kya hai`,
  `farq`, `tarika`, `tariqa`, `purana`, `shuru`, `talash`. Match the existing
  entries' spelling variants — speech and typing both mangle these.

## Intent families — when you must not choose

If a word could honestly mean three reports, offer three. A family lists them as
tappable questions phrased exactly as the engine expects. See
`ask-backlog/references/triage.md` for the shape and the caveat that a family
offer does **not** clear a backlog entry.

## Every change gets a regression case

In the same edit, not afterwards:

- `scripts/ask-routing-check.ts` — one case per new guide/FAQ (`guide:id` /
  `faq:id`), plus a `data` case for the nearest phrasing that must NOT be
  captured by it.
- `scripts/ask-analysis-check.ts` — one case per new alias or family cue, plus
  one proving a named question still wins.

Then, from `tajir/`:

```bash
npm run check:ask && npm run check:ask-analysis && npm run lint && npm run typecheck
```

## Never

- Generate, estimate, summarise or infer anything at runtime. No model, no API.
- Write a step naming a screen, menu path or field label you have not read in the
  code.
- Add a `link` to a route that is not in `app/(app)`.
- Offer a `related` or family question that Ask cannot answer.
- Edit `docs/ask-queries/` — it is generated from the log and overwritten.
