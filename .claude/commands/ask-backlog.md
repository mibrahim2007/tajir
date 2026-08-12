---
description: Triage and clear the Ask chatbot's unanswered questions (optionally for one tenant) via the ask-curator agent
argument-hint: "[tenant name] [--dry-run]"
---

Work the Ask chatbot's unanswered-question backlog for: **$ARGUMENTS**

(No tenant given → every tenant. `--dry-run` → triage and report only, no edits.)

## 1. Show the backlog first

```bash
cd tajir && npm run ask:backlog
```

Add the tenant name as a filter if one was given (`npm run ask:backlog -- ibrahim`).

Show the user this output before doing anything else — it is the chatbot's own
question log, and the counts (`fixed` / `partial` / `open`) tell them how much
work there actually is. If the export looks stale, offer to regenerate it with
`npm run ask:history` (needs `.env.local`) rather than running it unasked.

## 2. Hand it to the agent

If this is a `--dry-run`, stop after step 1 and summarise instead.

Otherwise launch the **ask-curator** agent with the Agent tool, passing:

- the tenant filter, if any
- the `partial` and `OPEN` entries from step 1, verbatim, with their hit counts
- the instruction to follow the `ask-backlog` skill, and to run
  `check:ask`, `check:ask-analysis`, `check:ask-history`, `lint` and `typecheck`
  before reporting

For a large backlog across several tenants, launch one agent per tenant in a
single message so they run concurrently — the tenant files are independent, but
`lib/ask/intents.ts` is not, so tell each agent which layer it owns, or run them
sequentially if they would all be editing the alias table.

## 3. Relay the result

The agent's report is not shown to the user — relay it yourself:

- what was added, and to which layer
- what is still open and why
- **any question that needs a new data query** — flag these separately; they are
  a product decision, not a content edit, and the agent is instructed not to
  build them
- the real check output

Then remind them the backlog file only refreshes on the next `npm run ask:history`
run, since it is generated from the `ask_query_log` table.
