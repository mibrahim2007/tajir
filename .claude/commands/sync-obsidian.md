Write a session note to the Obsidian vault covering **all** work done in this
session — UI, backend, database, docs, config, tests. Not UI only.

## 1. Find out what actually changed — do not work from memory

Run these before writing anything, and base the note on their output:

```
git status --porcelain
git diff --stat
git diff            # for the substance of each change
```

Include work that git cannot see — files written outside the repo, a migration
applied to a remote database, a deployment, a config change — but **say
explicitly** that it is untracked so a future reader knows it will not show up in
`git log`.

If nothing changed at all this session, say so in one line and write the note
anyway: an explained gap in the Sessions log is useful; a missing note looks like
a failed sync. Never invent changes to fill a template.

## 2. Group the changed files by area

Use only the groups that have content — omit empty sections entirely rather than
writing "none".

| Area | Covers | Per-file, record |
|---|---|---|
| **UI** | `components/`, `app/**/*.tsx` | what changed · why · **Tailwind/shadcn classes and lucide icons added** |
| **Server / logic** | server actions, API routes, `lib/` | what changed · why · any contract or signature change callers depend on |
| **Database** | `supabase/migrations/`, `db/` | what changed · why · whether it is applied locally, remotely, or not yet |
| **Docs / specs** | `docs/`, `*.md`, planning artifacts | what changed · why · who the audience is |
| **Config / tooling** | `.claude/`, scripts, `package.json`, CI | what changed · why · anything that alters how the project is built or run |
| **Tests / checks** | test files, `scripts/*-check.ts` | what changed · why · pass/fail state with the actual output |

For every file: **what changed**, **why it changed**. Add the area-specific
column above. Keep the "why" concrete — the reason a future reader could not
reconstruct from the diff.

## 3. Also capture the parts a diff cannot show

- **Decisions worth keeping** — what was chosen, and what was rejected and why.
- **Open / next** — anything unfinished, unverified, or deliberately deferred.
- **Gotchas** — bugs found, wrong assumptions corrected, things that bit us.

These are usually the most valuable part of the note. A diff shows what the code
became; only the note records why it is not something else.

## 4. Write it

Save to:
`D:\Obsidian_Project\My Tajir Project\Sessions\$DATE-session-sync.md`

**If a note for today already exists, update it — append the new work and revise
the summary. Never overwrite a note that already has content in it.**

Frontmatter:

```yaml
---
date: $DATE
tags: [tajir, session, <area tags>]
---
```

Area tags are conditional on what the session actually touched — add `ui` and
`shadcn` only when UI files changed, plus any of `backend`, `db`, `docs`,
`config`, `tests`, and a feature tag where one fits (`ask`, `voice`,
`accounting`, …). Do not carry tags for areas the session did not touch.

Structure the body as: a short **Summary** (with a counts table), then one section
per area group, then **Decisions worth keeping**, **Open / next**, and
**Related** (link `[[Tajir Project]]`, the previous session note, and the key
source files). Match the formatting conventions of the most recent existing note
in `Sessions/`.
