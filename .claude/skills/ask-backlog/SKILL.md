---
name: ask-backlog
description: Clear the Ask chatbot's unanswered-question backlog, tenant by tenant. Use when asked to triage, work, answer or clear the unanswered Ask questions in tajir/docs/ask-queries, when someone says "the chatbot could not answer X", after running `npm run ask:history`, or when adding coverage to lib/ask (aliases, intent families, keywords, FAQs, guides). Runs the triage script, implements each fix in the right layer, pins it with a regression case, and verifies with the Ask checks.
---

# Working the Ask backlog

The Ask chatbot logs every question to `ask_query_log` and marks whether it could
answer. `npm run ask:history` exports that log to `tajir/docs/ask-queries/` — one
markdown file per tenant, plus a `README.md` index. The **Unanswered** list in
each tenant file is a to-do list written by the people actually using the app.

This skill turns that list into committed coverage. Work from `tajir/` (the app
root — the directory containing `lib/ask/engine.ts`).

## The one constraint that governs everything

**Ask contains no language model, and this work must not introduce one.** Every
answer is either a row already in the tenant's database or a sentence a human
wrote and committed to the repo. You are not making the chatbot smarter at
runtime; you are writing the missing hand-written answer, or the missing keyword
that reaches an existing one. If a backlog question can only be answered by
inference, the correct outcome is to say so — not to reach for a model.

Read `tajir/docs/ask-chatbot-port-prompt.md` if you need the full design rationale.

## Step 1 — Get a current picture

```bash
cd tajir
npm run ask:backlog                 # every tenant
npm run ask:backlog -- ibrahim      # one tenant
npm run ask:backlog -- --json       # machine-readable
```

The exported docs are a **snapshot**, so some entries are already fixed. The
script replays the offline classifier over each unanswered question and labels it:

| Status | Meaning | Action |
| --- | --- | --- |
| `fixed` | The engine answers it now | Nothing. Do not re-fix. |
| `partial` | Falls through to an intent family, which **offers** related questions but does not answer | Still counts as unanswered in the log. Give it a real answer. |
| `open` | Nothing matches | Work it. |

`partial` is the one people get wrong. `app/actions/ask.ts` logs the **original**
engine response, not the suggestion list — so a family offer never clears the
backlog entry. It is a better dead end, not an answer.

The script cannot see the tenant's customer/supplier/item names (that needs the
database), so a question that would resolve to an entity name shows as `open`. It
over-reports rather than declaring the backlog clear.

If the export itself is stale, regenerate it first — needs `.env.local`:

```bash
npm run ask:history                 # or: npm run ask:history -- <tenant name>
```

## Step 2 — Route each question to a layer

Work most-asked first; the script already sorts that way. Decide per question,
and see `references/triage.md` for the full decision table and the exact edit
recipe for each layer.

| The question is… | Layer | File |
| --- | --- | --- |
| a bare word naming **one** report ("stock", "bounced") | whole-word alias | `lib/ask/intents.ts` → `WHOLE_WORD_ALIASES` |
| a bare word naming **an area**, several reports could answer ("month", "opening") | intent family | `lib/ask/intents.ts` → `INTENT_FAMILIES` |
| another phrasing of an existing report ("show last month sale") | intent keyword | `lib/ask/intents.ts` → `NONENTITY_KEYWORDS` / `SPECIFIC_KEYWORDS` |
| "how do I …" — wants steps | guide | `lib/ask/guides.ts` → `GUIDES` |
| "what is …" / "why did …" — wants a concept | FAQ | `lib/ask/faq.ts` → `FAQS` |
| an entity's name typed alone or misspelled | usually already handled | verify before touching the engine |
| **not a party at all** — an account, a screen, a concept | check what it resolved to | `lib/ask/resolve.ts`; a word must not match inside a name |
| a report that does not exist | **do not invent an answer** | write it up as a proposal (Step 5) |

Two rules that are load-bearing:

- **An alias fires only when it IS the whole question.** As a substring, "ledger"
  would hijack "ledger of Ali Traders". Add to `WHOLE_WORD_ALIASES`, never to
  `NONENTITY_KEYWORDS`, for bare words.
- **Never guess between reports.** If a word could mean three things, it is a
  family (offer all three), not an alias to whichever seems likeliest.

Use the `ask-answer` skill for the actual writing — it carries the house
standards for guide steps, FAQ answers, keyword lists and Roman-Urdu variants.

## Step 3 — Pin every change with a regression case

The failure mode here is silent: a data question that starts returning
instructions, and a concept question that returns an empty ledger, both look like
working software. **Add a case in the same edit as the keyword.**

- `scripts/ask-routing-check.ts` — static-layer routing (`guide:…`, `faq:…`,
  `faq-index`, or `data`). Add every new guide/FAQ here, and add a `data` case
  for any nearby phrasing that must NOT be captured.
- `scripts/ask-analysis-check.ts` — aliases and intent families. Add the alias
  under "The bare words from the log now route", plus a case proving a named
  question still wins ("ledger of Ali Traders" must not become receivables).

Quote the question **exactly as the user typed it**, including the typo — the
existing table carries `comparision` on purpose, because that is what was typed.

## Step 4 — Verify

Run all of these from `tajir/` and show the real output, not a summary:

```bash
npm run check:ask            # static routing + email commands + FAQ structure
npm run check:ask-analysis   # aliases + intent families
npm run check:ask-resolve    # entity resolution — a word must not match inside a name
npm run check:ask-history    # recall / similarity
npm run lint
npm run typecheck
npm run ask:backlog          # the entries you worked should now read "fixed"
```

A backlog entry is only done when `ask:backlog` calls it `fixed`. `partial` means
you added an offer, not an answer.

## Step 5 — Report

Per tenant, state: how many entries were `fixed` in the export before you
started, what you added and to which layer, what is still open and why, and any
question that needs a **new data query** — those are a product decision, not a
content edit. For those, describe the report, the columns, and which existing
screen already shows the same figure (the reconciliation check), and stop there
unless asked to build it.

## Never

- Add an LLM, an API call, or any inference to the runtime path.
- Add a bare word to `NONENTITY_KEYWORDS` — it matches as a substring and will
  hijack real questions.
- Hand-edit anything in `docs/ask-queries/` — it is generated and overwritten.
- Write a guide step naming a screen or field label you have not verified against
  the actual component.
- Report the backlog as clear on the strength of `partial` entries.
