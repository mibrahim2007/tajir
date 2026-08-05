# Prompt: build an "Ask" chatbot + voice record entry (deterministic, no LLM)

> **How to use this.** Fill in the seven lines in "About this application" below,
> then copy everything from the `---` down into a fresh Claude Code session opened
> in the target application's repository. The rest is stack-agnostic and needs no
> editing. It is self-contained — it does not assume the other instance can see
> any other codebase.
>
> If you leave a line blank, the receiving instance is told to inspect the repo
> and ask you, rather than assume — so a blank costs you a round-trip, not a
> wrong build. The two lines it cannot discover on its own are the **spoken
> vocabulary** and the **target form**; fill those in if you fill in nothing else.

---

## About this application (fill in before sending; "unknown" is an acceptable answer)

| | |
| --- | --- |
| **What the business does** | e.g. distribution / clinic / workshop / school / logistics |
| **Stack** | framework, language, UI library — or "inspect and tell me" |
| **Data layer** | Postgres + SQL functions / Prisma / MySQL / MongoDB / an API — or "inspect and tell me" |
| **Tenancy** | multi-tenant (many orgs) / single org, many users / single user |
| **Client target** | web browser / mobile app / desktop — **see the speech note below** |
| **Money & numbers** | currency + how users say large numbers aloud (e.g. "lakh/crore", "million") |
| **Languages spoken** | e.g. English only / English + Spanish / English + Roman Urdu mix |
| **Form to voice-enable** | the one high-frequency create form — or "you pick, and justify it" |

Anything above marked "inspect and tell me" or left blank: work it out in Step 0
and put your finding in the plan for approval. Do not guess and proceed.

**Speech support depends on the client target.** The design below uses the
browser's own Web Speech API, which exists in Chrome and Edge on the web. If this
application is a **native mobile app**, that API does not exist — use the
platform's on-device speech recogniser instead (`expo-speech-recognition`,
`@react-native-voice/voice`, or the OS API), keeping the same interface and the
same rule that no audio leaves the device. If neither is available, build both
features **typed-only**: every parser and every answer works identically on typed
input, so the feature is complete without a microphone. Say which path you took.

---

## What I want you to build

Two related features that share one speech hook and one design philosophy:

- **Feature A — "Ask"**: a chat-style page where a user types (or speaks) a
  question in plain language and gets back a formatted answer — a table, a stat
  grid, a how-to guide, or a plain-language FAQ answer. **Read-only.**
- **Feature B — voice record entry**: on a high-frequency data-entry form, the
  user says the whole record in one sentence ("paid 5000 cash for office rent
  yesterday") and the form **pre-fills** for them to check before saving.
  **Never writes directly.**

Build them in that order; Feature B reuses Feature A's speech hook. Both are
specified in full below.

**The single most important constraint: there is NO language model, no API key,
and no external service anywhere in either feature.** The user's sentence does
not get "understood" — it gets *classified* or *pattern-matched* by deterministic
code into one of a fixed set of hand-written answers, hand-written read-only
queries, or named form fields. Nothing is inferred, estimated, generated, or
summarised by a model. Every number shown traces back to a row already stored in
the database, and every explanatory sentence is text a human wrote and committed
to the repo. Speech recognition is the **platform's own, on-device** recogniser
(see the note above) — no audio leaves the device through this app, and there is
no transcription service.

Why that matters, so you don't "improve" it later: this feature is used by people
who make financial/operational decisions from what it says. A model that gets a
balance 5% wrong, or hallucinates a workflow step, is worse than useless — and
its being wrong is invisible. A keyword classifier that mis-routes shows the
wrong (but *true*) answer, and the user just rephrases. Prefer being obviously
unhelpful over being plausibly wrong.

---

## Step 0 — Understand this application first (do this before writing code)

Do not start coding. First explore the repository and produce a short written
plan covering:

1. **Stack**: framework, router, how server-side data access works (server
   actions? API routes? ORM? raw SQL? stored procedures?), how the UI is styled.
2. **Tenancy / auth**: how a request is authenticated and how rows are scoped to
   the current user or organisation. Find the existing helper (e.g. a
   `requireAuth()` equivalent) — the Ask feature MUST reuse it and must never
   accept a tenant/org/user id from the browser.
3. **The domain**: what are the *entities users refer to by name*? (In a trading
   app: customers, suppliers, stock items, employees. In yours it may be
   projects, patients, tickets, vehicles, SKUs, students…) List them.
4. **The questions worth answering.** Read the existing reports, dashboards and
   list screens. Every report that already exists is evidence of a question the
   user asks. Propose ~12–16 data questions and ~30–45 concept/how-to questions
   drawn from what the app actually does.
5. **The money/quantity formatting helpers** that already exist, so the Ask
   output matches the rest of the app.
6. **For Feature B — which form to voice-enable.** Pick the *highest-frequency,
   lowest-field-count* create form in the app: the one a user fills many times a
   day, where every field is either a number, a date, a choice from a short list,
   or a short free-text label. (In the reference implementation it is "record an
   expense": amount, date, expense account, cash-or-bank, description.) A form
   with line items, or one where a wrong value is expensive to undo, is the wrong
   candidate. Name your pick, list its fields, and say which are required.
7. **The vocabulary your users actually speak.** How do they say numbers, dates,
   and category names out loud — including any second language or mixed dialect?
   This is the input to the parser's word lists and cannot be guessed from the
   code. Ask me if you are unsure.

Show me that plan and the proposed question list. Wait for my approval before
implementing. If something in the design below genuinely doesn't fit this app,
say so in the plan rather than silently deviating.

---

# FEATURE A — the Ask page

## Architecture

Three answer layers behind one input box, with a strict routing order between
them.

The file layout below is written in Next.js/React terms because that is where it
was proven. **Map each role onto this project's own conventions and keep the
roles, not the paths** — if this app uses REST controllers, an API endpoint plays
the "server action" role; if it is Vue or Svelte, the renderer is a component in
that framework; if there are no migrations, the queries live wherever this
project keeps its data access. Only two structural rules are non-negotiable: the
**response-type file must be importable by client code** (so keep server imports
out of it), and the **parsers/matchers must be pure modules** with no I/O, so the
check scripts can run them headlessly.

```
<data layer>/     ask_* queries    read-only, scope-filtered (layer 1)
lib/ask/types.ts                   response shapes + example prompt lists
lib/ask/guides.ts                  hand-written how-to guides + matcher (layer 2a)
lib/ask/faq.ts                     hand-written concept answers + matcher (layer 2b)
lib/ask/engine.ts                  classifier + entity resolution + runners (layer 3)
<route>/ask/page                   server-rendered page, auth-guarded
<route>/ask/ask-chat               client chat UI + renderer
<server entry>/ask                 thin action/endpoint: calls the engine, catches
scripts/ask-routing-check.ts       routing regression check (`check:ask`)

hooks/use-speech-recognition       shared by both features
lib/voice/parse-<record>.ts        deterministic sentence → draft record (Feature B)
components/voice-<record>-input    the speak/type panel above the form
scripts/voice-parse-check.ts       parser regression check (`check:voice`)
```

Wire both check scripts into whatever task runner this project uses — an npm
script, a Makefile target, a test suite. If the project has a real test runner,
put the cases in it instead of a standalone script; the point is that they run in
CI, not that they are a script.

### Layer 1 — the data queries

One named, read-only query per question, living **as close to the database as
this stack allows**. On Postgres that means a SQL function per question
(`language sql stable`); with an ORM it means a single named repository function
per question doing its aggregation in one query; over an internal API it means
one endpoint per question. Whichever it is, these rules hold:

- **Read-only, enforced structurally** — a `stable`/read-only marker, or a
  read-only connection/role. Never a write, never a dynamic query built from user
  text. The question selects *which* prepared query runs; it never becomes part
  of one.
- **The scope id is a required first parameter and is always filtered on**, and
  it comes from the authenticated session — the client never supplies it. In a
  multi-tenant app that is the tenant/org id; in a single-org app it is the user
  id wherever rows are user-owned. If this app genuinely has no row-level scope,
  say so in the plan and state what protects the data instead.
- **If the engine runs with an elevated/service-role connection, every single
  query must filter on the scope id by hand — there is no backstop.** Row-level
  security does not apply to a service role, so one forgotten filter is a
  cross-tenant data leak, and it will not fail loudly; it will return more rows
  and look like a working feature. Prefer the ordinary user-scoped connection if
  this app's row-level security already handles it. If you must use an elevated
  one, say so in the plan, funnel every call through a single helper that takes
  the scope id as a required argument, and list the queries for me to check.
- **Aggregate in the database, not in application code.** Client libraries
  commonly cap at 1000 rows — a total computed after a silent truncation is wrong
  and looks right. This is the whole reason the aggregation lives at this layer.
- Take a limit parameter on anything list-shaped.
- Return a flat, typed row set. Document in a comment what the numbers mean and
  any approximation ("value uses the latest purchase rate, so it is an estimate,
  not a booked figure") — that comment becomes the subtitle the user sees.

**Choosing the question set — derive it from THIS domain, don't copy the list
below.** The reliable method: every existing report, dashboard tile, and filtered
list screen in the app is evidence of a question someone already asks. Convert
each into a sentence a user would say out loud.

<details><summary>Reference example only — a trading/distribution app. Use as a
shape, not a checklist.</summary>

per-party ledger · per-party summary · top-N customers by value · slow/inactive
customers · slow-moving stock · outstanding to collect · outstanding to pay ·
low stock · inventory summary · everything overdue · cheque register list +
summary + lookup-by-number · universal name search.

The transferable *shapes* are: **one entity's history**, **one entity's
headline numbers**, **top-N by value**, **inactive/stale by time**, **what is
outstanding in each direction**, **what is past its date**, **a sub-register
with filters**, **lookup by reference number**, and **search everything by
name**. Nearly every business app has all nine; only the nouns change. For a
clinic they are patients and appointments; for a workshop, jobs and parts; for
a school, students and fees.
</details>

The **universal name search** (described under Layer 3) is not optional in any
domain — it is what stops the engine guessing between similarly-named records.

### Layer 2 — static guides and FAQs (TypeScript data, no DB)

Two hand-written arrays. They answer the half of the input box the data engine
can only shrug at.

```ts
type Guide = {                      // "how do I …" → numbered steps
  id: string
  title: string
  subtitle?: string
  keywords: string[]                // matched as substrings of the lowered question
  intro?: string
  steps: string[]                   // imperative, naming the ACTUAL screen labels
  notes?: string[]                  // caveats, gotchas, accounting consequences
  links?: { label: string; href: string }[]   // deep links into the app
  related?: string[]                // tappable follow-up questions
}

type Faq = {                        // "what is …" / "why did …" → answer first
  id: string
  category: FaqCategory             // for the browsable index
  question: string                  // shown as the answer's title
  keywords: string[]
  answer: string                    // one or two sentences, answers directly
  points?: string[]                 // supporting detail, only where it earns it
  links?: { label: string; href: string }[]
  related?: string[]
}
```

Writing standards — these are the whole value of the layer:
- Write them by **walking the actual application**, screen by screen, setting by
  setting. Field names in steps must be the real labels on the real forms. A
  guide that has drifted from its screen is worse than no guide.
- Answer in plain language, no jargon. Assume the reader was handed a login this
  morning and has never used software like this.
- Include the *consequence*, not just the click path ("a negative figure means
  they have already paid you in advance", "this only sets the subledger; for the
  balance sheet to agree you must also…").
- Include local-language keyword variants if your users mix languages (the
  reference implementation carries Roman-Urdu cues: `kaise`, `kya hai`, `farq`,
  `tarika`).
- Target roughly 9–12 guides and 30–40 FAQs grouped into ~7 categories.

**The matching discipline (this is subtle and matters).** A topic keyword alone
must NOT trigger a static answer, because "sale invoice of Ali Traders" wants
data, not instructions. So a match requires *either*:

- the question carries an explicit cue phrase (`how to`, `how do i`, `what is`,
  `difference between`, `why does`, `can i`, `explain`, `steps to`, …), **or**
- the matched keyword is itself self-evidently a question (it starts with
  `what is` / `how ` / `why ` / `can i`, or contains `difference between` / ` vs `).

**Longest matching keyword wins**, so a specific entry ("customer opening
balance") beats a general one ("opening balance").

Each file also exports index keywords (`faq`, `common questions`, `help topics`,
`tutorial`, …) that return the browsable topic list instead of one answer.

### Layer 3 — the data engine

`runAsk(question)`:

1. Authenticate and get the org id from the session. Empty question → help card.
2. Lowercase the question. **Route the static layers first** (order below).
3. Load the name lists for every user-nameable entity type (id + name, capped).
4. Explicit-search escape hatch: if the question matches
   `^(search|find|look for|look up|show all|list all)\s+(.{2,40})$`, always run
   the universal search on the captured term.
5. **Disambiguation before guessing.** If no full entity name appears verbatim in
   the question, take the question's most-matching distinctive word and count how
   many entity names contain it. **If 2 or more match, list them all** via the
   universal search rather than silently picking one. (Learned the hard way: a
   fragment matching three stock items used to return one item's ledger with no
   sign the other two existed.)
6. Resolve one entity per type, two passes:
   - **Pass 1** — the entity's full name appears as a substring of the question;
     longest name wins. Most reliable.
   - **Pass 2** — partial/ILIKE-style. Tokenise the question, drop tokens under 3
     chars and drop everything in a **stopword list of structural/intent words**
     (`ledger`, `summary`, `top`, `customer`, `stock`, `overdue`, `who`, `show`,
     …). Score each name by shared content in *both* directions (question word
     inside the name; name word inside the question word). Require a minimum
     score so one short common fragment can't drag in an unrelated record.
     The stopword list exists so that "top customers" cannot resolve a customer
     literally named "Top Store". Build yours from this domain's intent words.
7. Score intents. A keyword phrase table `intent → phrases[]`, `+2` per substring
   hit; a second table of *specific* phrases at `+3` so a narrow intent beats a
   broad one that also matches a bare word. Then entity-aware boosts:
   entity + ledger-word → that entity's ledger (+4/+5); entity + summary-word →
   its summary (+4); a bare name with no intent word → its summary (+2). Delete
   intents that a more specific one supersedes (e.g. drop the generic "overdue"
   intent when the question is cheque-specific, because the cheque intent already
   supports an overdue filter).
8. Highest score wins; run that intent's runner. If nothing scores: when the
   question clearly wanted a ledger/summary but named nothing recognisable, say
   exactly that and show an example of the right phrasing — **do not guess**.
   Otherwise show the help card.
9. Parse a relative period out of the wording (`\d+ (day|week|month|year)s?`)
   with a sensible default per intent (90 days for "slow", 365 for "top").

**Routing precedence — implement in exactly this order, and comment why:**

```
1. guide index keywords     → list of how-to topics
2. faq index keywords       → browsable topic list
3. comparative question?    → FAQ   ("difference between X and Y" wants the
                                     concept, not the steps for whichever it
                                     happened to name first)
4. matchGuide()             → how-to steps
5. matchFaq()               → concept answer   (after guides: "how to create a
                                     sale invoice" should get steps, not theory)
6. data engine
```

The static layers must come before any data work: a question like "how to create
a sale invoice" contains words that would otherwise partial-match an entity name
and get routed to a ledger.

---

## Response contract

One discriminated union, in a file with **no server imports** so the client
component can import it:

```ts
type AskColumnKind = 'text' | 'money' | 'number' | 'qty' | 'date'  // drives
                                    // client formatting + right-alignment
type AskTable  = { kind:'table';  title; subtitle?; columns: AskColumn[];
                   rows: Record<string, string|number|null>[];
                   summary?: string;   // one-line takeaway ABOVE the table
                   footer?: string }   // e.g. the total line
type AskStats  = { kind:'stats';  title; subtitle?; stats: {label; value;
                   tone?: 'default'|'positive'|'negative'}[]; summary? }
type AskText   = { kind:'text';   title?; body }
type AskGuide  = { kind:'guide';  title; subtitle?; intro?; steps: string[];
                   notes?: string[]; links? }
type AskFaq    = { kind:'faq';    title; category?; answer; points?; links? }
type AskTopics = { kind:'topics'; title; subtitle?;
                   groups: { category; questions: string[] }[] }

type AskResponse = (…union…) & { suggestions?: string[] }   // tappable follow-ups
```

Rules that make the answers feel answered rather than dumped:

- **Every response carries a one-line `summary` in words**, not just a grid.
  "Ali Traders owes you PKR 412,000." — "3 items, 2 customers match 'card'." —
  "Bay 2 has been idle 11 days." — "Dr Ahmed has 6 unconfirmed appointments." —
  "12 of these had no sales at all in the last 90 days." The table is the
  evidence; the sentence is the answer.
- **Every response carries `suggestions`** — 2–3 sensible next questions. This is
  how a user discovers what the box can do without documentation.
- A suggestion **ending in a space** ("Ledger of ") means "needs a name": tapping
  it puts it in the input box and focuses it instead of submitting.
- Empty results get a written sentence, never a blank table ("No customer
  currently owes you — all receivables are clear.").
- Long tables: slice to the latest ~100 rows and say so in the subtitle
  ("Showing the latest 100 of 1,284 entries").

---

## UI

A single client component, full-height column: header, scrolling turn list,
pinned composer at the bottom. Auto-scroll to the end on every new turn.

- **Empty state** carries three grouped sets of example prompts as tappable
  chips: newcomer questions ("I am new — where do I start?"), data questions
  ("Who owes me money"), how-to questions ("How to create a sale invoice"). Most
  users never type a novel question on day one; they tap.
- User turns: right-aligned bubble + avatar. Assistant turns: icon + bordered
  card containing the rendered response.
- One `ResponseView` component switches on `kind` and renders: text, FAQ
  (category label → answer → bullets → deep links), topics (chips grouped by
  category), guide (numbered steps in circles → notes in a muted box → deep
  links), stats (responsive card grid, tone-coloured values), table (horizontally
  scrollable, sticky-ish header, right-aligned + tabular-nums for numeric kinds,
  footer line).
- Pending state says what it is doing — "Reading your data…" — not "Thinking".
  It is not thinking.
- Submit disabled while pending; refocus the input after each answer.

## The shared speech hook (`useSpeechRecognition`)

One hook, used by both features. Wrap the **browser's own** Web Speech API
(`SpeechRecognition` / `webkitSpeechRecognition`). No third-party transcription
service, no API key, no audio leaving the browser through this app — state that
in a comment, because someone will ask.

```ts
useSpeechRecognition(onFinal: (text: string) => void): {
  supported: boolean | null   // null until probed on mount
  listening: boolean
  transcript: string          // live, including the interim guess
  error: string | null
  lang: string; setLang: (l: string) => void
  start(): void; stop(): void; reset(): void
}
```

- `supported` starts `null` and is probed in an effect, so server and client
  markup agree on the first render; hide the mic button entirely where
  unsupported rather than showing it broken.
- `continuous = false`, `interimResults = true`. Surface the interim transcript
  so it is obvious what was heard.
- Accumulate final results and fire `onFinal` **once**, from `onend`, only when
  non-empty. Keep the callback in a ref so a changing closure doesn't restart
  recognition.
- Stop recognition on unmount, or the browser's mic indicator stays lit.
- Map error codes to plain sentences that always end with the fallback:
  `not-allowed` → "Microphone permission was refused. Allow it in the browser, or
  type instead." `no-speech` → "I did not catch anything. Try again, or type
  instead." `audio-capture` → "No microphone was found. You can type instead."
- Export a language list (`en-US`, plus whatever your users speak) so the caller
  can offer a picker.

**The one rule that differs by caller, and it is a safety rule:**

| Caller | Behaviour on final transcript | Why |
| --- | --- | --- |
| Ask (read-only) | **submit immediately** | a misheard question costs a retry |
| Any form that writes | **pre-fill only, never submit** | a misheard amount corrupts the ledger |

## Ask's routing regression check

A check named `check:ask` in this project's task runner (see Architecture). It
re-implements the routing precedence in ~8 lines and asserts a table of
`[question, expected-route-id]` pairs — every newcomer question, every index
phrase, every how-to, plus the phrasings that mis-routed during development, plus
a set that must fall through to `data`.

The failure mode here is silent: a data question that starts returning
instructions, and a concept question that returns an empty ledger, both look like
working software. **Add a case every time you add a keyword.**

---

# FEATURE B — voice record entry

Let the user *say* a whole record in one sentence instead of tabbing through a
form. The sentence is parsed **on the device** by a deterministic parser and used
to **pre-fill** the existing form. The user reviews it and presses the normal
save button.

```
"paid 5000 cash for office rent yesterday"
   → amount 5000 · cash · account 6200 Rent · date = yesterday
   → description "Office rent"
```

**That expense sentence is the worked example throughout this section because it
is where the design was proven — it is not the record you are building.** Your
target form is the one named at the top of this document. Translate every field
mentioned below onto its fields; the mechanics are identical for
*"job 4471 done, 3 hours labour, two filters, Tuesday"* or
*"Mrs Khan, follow-up, thirty minutes, next Monday 4pm"*. What generalises is the
category of field: **a number, a date, a choice from a short list, and a short
free-text label.** If your form has a field that fits none of those — a file
upload, a multi-row table, a signature — leave it out of the parser entirely and
let the user fill it by hand.

## The safety design — read this before writing a line

**A voice note NEVER posts anything.** It only ever fills fields in a form the
user then checks and submits. That single decision is what makes a fuzzy parser
acceptable in a financial application: a misheard word costs the user a glance,
not a wrong entry in the ledger. Do not add a "just save it" shortcut, and do not
let the parser reach a write path of its own. It returns a plain object; the form
component sets its fields from that object and nothing else happens until the
user presses the form's normal save button.

Three consequences that follow, all of which you must implement:

1. **Show what was understood, field by field.** After a parse, render a small
   "Filled in — please check" panel listing every field with a tick where it was
   heard and "not heard" where it was not. The user must be able to see the
   parse, not just its effects on the form below.
2. **Never blank a field the parser missed.** Apply only the values that were
   found. A second attempt then *adds* to the draft instead of wiping what the
   user has already corrected by hand. (Exception: an explicitly-heard negative,
   e.g. "cash" meaning "no bank", must clear the bank field — say so in a
   comment, because it looks like a bug otherwise.)
3. **Name the fields it could not fill, in words.** "I could not pick out the
   amount — set it below." / "I could not tell which expense account — choose it
   below." Not a generic "parse failed".

## The parser (`lib/voice/parse-<record>.ts`)

A pure function. No I/O, no imports from the server, fully unit-testable:

```ts
parse<Record>(text: string, ctx: { today: string; <lookup lists…> }): Parsed<Record>

type Parsed<Record> = {
  …one nullable field per form field…
  description: string
  /** field-by-field, so the UI can show what was understood */
  found: { amount: boolean; date: boolean; account: boolean; paidBy: boolean }
}
```

`ctx` carries **the tenant's own lookup lists** (accounts, categories, banks…)
passed down from the server page. The parser matches against the user's real
data, so a business that renamed a category still resolves. Never hard-code the
option list inside the parser.

Export the sub-parsers individually (`parseAmount`, `parseDate`, `parsePaidBy`,
`matchAccount`) so each can be checked on its own.

### Sub-parser: amount

Applies to any numeric field, not just money. Order matters — try in this
sequence:

1. **A number immediately followed by a magnitude word**, because that is how
   people actually speak ("five thousand", "1.5 million", "5 hazar", "2 dozen").
   Look up the token before the multiplier as digits *or* as a number word. A
   bare multiplier with nothing in front ("paid thousand") still means one of
   them.
2. **A number adjacent to a unit or currency word**, either side.
3. **The largest bare number in the sentence.**
4. **A spelled-out number with no multiplier** ("fifty").

Two word lists to build, both taken from the "Money & numbers" and "Languages
spoken" lines at the top of this document — **not** from any example in here:

- **Magnitude words** for this locale. A South-Asian business says
  lakh/crore/hazar; a Western one says million/billion; a warehouse may say
  dozen/pallet/carton. Include the local spellings **and their common
  mis-transcriptions** — speech recognition returns `hazaar`, `hazzar`, `hzar`
  for one spoken word, and it will do the same to whatever yours are.
- **Number words** 0–100 in every language the users mix.

If the "Languages spoken" line says English only, drop the second-language
entries entirely rather than carrying dead vocabulary.

**Critical: strip date tokens before looking for the amount.** Otherwise "paid
900 bank charges 05/07/2026" reads the *year* as the amount, because 2026 is the
largest number in the sentence. Blank out `dd/mm/yyyy`, `dd Month yyyy`,
`Month dd`, and "N days ago" patterns first. This bug is not hypothetical.

### Sub-parser: date

Resolve against a `today` passed in from the server — never `new Date()` inside
the parser, so it stays testable and timezone-stable.

Handle: today / yesterday / day-before-yesterday and their local equivalents;
"N days ago"; "12 january" and "january 12" and "12 jan 2026"; and numeric
`dd/mm/yyyy`, read **day-first** if that is the local convention (say which you
chose in a comment).

Ambiguous words need a documented decision. The reference implementation notes
that Urdu "kal" means both yesterday *and* tomorrow, resolves it to **yesterday**
because a recorded transaction has already happened, and relies on the UI showing
the resolved date so the user can correct it. Find your equivalent and write the
reasoning down.

### Sub-parser: category / account matching

Two passes:

1. **A hint table** mapping *spoken* terms to a *fragment of the option's name*:
   `{ spoken: /\b(rent|kiraya|kraya)\b/, nameFragment: 'rent' }`. Match the
   fragment against the tenant's own list. This is the layer that absorbs
   synonyms, other languages, and speech-recognition mangling.
2. **Word overlap** — any distinctive word (≥4 chars, not a stopword) appearing
   in an option's name, scored by length, with a minimum threshold so a single
   short word can't drag in an unrelated account.

Keep a stopword list of the verbs and connectives people say around the content
(`paid`, `spent`, `for`, `the`, `cash`, `bank`, plus local equivalents).

### Sub-parser: description

Strip everything already understood — currency words, digits, spelled-out
amounts, magnitude words, payment verbs, date words, connectives — and use what
is left, capitalised. If nothing distinctive remains, fall back to the matched
category name so a required description is never empty.

**One trap worth stating explicitly**, because it shipped and was caught in
production: a spelled-out amount must be stripped as a *pair* — the number word
together with the magnitude word that follows it. Removing number words
individually is unsafe, because they collide with ordinary words: in English
"one", "won" and "may"; in a mixed dialect far more ("do", "sat", "so" are all
both numbers and everyday words). So strip a number word **only** when it sits
directly in front of a magnitude word. Without this rule, "das hazar ka bijli ka
bill" produced the description "Das bijli bill" — and the English equivalent
leaves a stray "thousand" or a mangled label behind.

## The input component (`components/voice-<record>-input.tsx`)

A bordered panel sitting **above** the form it fills:

- Title, and a one-line example of what to say: *Say it in one line — e.g. "paid
  5000 cash for office rent yesterday". The form fills in for you to check.*
- Speak / Stop button (hidden where unsupported), a language `<select>`, and a
  **"Type instead"** toggle.
- **The typed box runs the identical parser.** This matters: where the browser
  has no speech support (Firefox, in-app webviews) the feature *degrades* rather
  than disappears, and it also gives you a way to test the parser by hand
  without a microphone. Show "This browser cannot listen. Type the same sentence
  below and it works identically."
- A "Heard: …" line echoing the transcript.
- The "Filled in — please check" panel described above, with the amber
  couldn't-hear message naming the missing fields.
- Errors from the hook, rendered inline.

The parent form supplies `onParsed` and applies the result with the
"only-set-what-was-found" rule.

## Parser regression check

A check named `check:voice` in this project's task runner. Build a fake lookup
list matching the app's default seeded options, fix a `TODAY` constant, and
assert a table of `[sentence, expected fields]`.

Cover, at minimum: every amount form (digits, comma-grouped, currency-prefixed,
each magnitude word, decimal magnitudes, spelled-out, each language); every date
form; each payment method and lookup match; and the specific sentences that broke
during development. Add three extra assertions beyond field values:

- **description correctness** for the spelled-amount cases,
- **no blank description** wherever a category was matched (the form requires
  one),
- exit non-zero if any of them fail.

A wrong parse here is a usability bug rather than a data bug — but a parser that
quietly stops finding amounts makes the feature useless with nothing looking
broken. That is what this check exists to catch.

---

## Non-negotiables (restate these in your plan)

1. No LLM, no external API, no API key, in any layer. Speech is the platform's
   own on-device recogniser; no audio leaves the device through this app.
2. Every query read-only and scoped to the authenticated org/user; the client
   never chooses whose data is read.
3. Aggregate at the data layer — never over a possibly-truncated client-side page
   of rows.
4. When the classifier is unsure, say so and show the correct phrasing. Never
   guess an entity, and never present one match when several matched.
5. Static content stays in step with the screens it describes; steps use the real
   field labels.
6. Every answer: one plain-language sentence + tappable follow-ups.
7. The server entry point wraps the engine in try/catch and returns a friendly
   text response — an exception must never blank the chat.
8. **A voice note never saves a record.** It pre-fills a form the user reviews
   and submits by hand. It sets only the fields it actually heard, and shows the
   user field by field what it understood.
9. Both voice surfaces degrade to typing, and the typed path runs the identical
   parser — never a second, divergent code path.
10. Both parsers are pure functions with no I/O, covered by checks that run in
    this project's normal test/task runner.

## Adapting this spec

Everything above is a **design**, not a transcript. It was proven in one
application; this is a different one. Where a rule genuinely does not fit this
stack or this domain, **say so in the plan and propose the equivalent** — that is
the expected behaviour, not a deviation. What you must not do is silently drop a
rule, or keep its letter while losing its purpose.

The parts that are the design rather than the details, and must survive any
adaptation:

- deterministic classification, never a model;
- read-only, session-scoped queries, aggregated at the data layer;
- hand-written explanatory content that stays in step with the real screens;
- an answer is a sentence plus evidence plus a suggested next question;
- ambiguity is surfaced, never resolved by guessing;
- voice pre-fills, and only the user saves;
- both text-matching layers are pinned by checks, because their failures are
  silent.

Everything else — file paths, framework idioms, the specific questions, the word
lists, the chosen form — is expected to differ.

## Deliverables

- The plan from Step 0, approved by me first. Do not write code before I approve.
- **Feature A**: the read-only queries, the `ask` modules, the page, the chat
  component, the server entry point, the routing check.
- **Feature B**: the parser module, the input component, the wiring into the
  chosen form, the parser check.
- The shared speech hook (or the platform equivalent, per the note at the top),
  used by both.
- A nav entry for the Ask page, permission-gated like the app's other pages.
- Both checks, plus this project's lint/typecheck/test commands, all passing —
  with the actual output shown, not summarised.
- **A reconciliation table.** For every Ask answer that reports a number which an
  existing report or dashboard tile also reports, show both figures side by side
  on real data and confirm they agree. This is the acceptance test that matters:
  a query that silently double-counts a join, or misses a reversal, produces a
  confident wrong number that no amount of typechecking catches. Where a figure
  legitimately differs from an existing report — different basis, different date
  cut — state why, and put that reason in the answer's subtitle so the user sees
  it too. If a number has no existing report to check against, say so explicitly
  rather than leaving it unverified in silence.
- A short note listing every question Ask can answer and every sentence form the
  voice parser handles, so I can review the coverage against what my users
  actually say.
