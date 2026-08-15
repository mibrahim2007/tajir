# Applied migration history

The verbatim record of every migration that has actually run against the
production database (`jappx-pos`, project `npawiohdvkjzfyrxfufm`), exported from
`supabase_migrations.schema_migrations`. Filenames are `<version>_<name>.sql`,
where `version` is the value the database records — so this folder replays in
exactly the order production received it.

Regenerate at any time with `npm run db:export-history`.

## Why this folder exists

`supabase/migrations/` cannot rebuild the database. It never could:

- It is **drizzle-kit's output directory** (`drizzle.config.ts` → `out`), which
  is why it contains `0000_lumpy_leper_queen.sql` and `meta/_journal.json`.
  That journal lists exactly one entry, so `drizzle-kit migrate` would create
  only the handful of tables in that 149-line baseline and stop.
- Everything from `0001_*.sql` onward is **hand-written SQL** that drizzle does
  not know about — it is absent from `meta/_journal.json`.
- Those hand-numbered files were applied through the dashboard / MCP, not by
  either tool's own push. The database therefore recorded them under generated
  timestamp versions (`20260709103732`), which match none of the local `0019`
  style names. The Supabase CLI has never been linked here (no `project_id` in
  `config.toml`, no `.temp/project-ref`), and if it were, it would treat every
  local file as unapplied and try to run the lot.

Net effect: **53 of the 98 applied migrations existed nowhere in version
control** — including `initial_schema`, the tenants/auth setup, and the whole
2026-06 security-hardening batch (`fix_security_definer_views`,
`revoke_anon_function_access`, `add_fk_indexes`, …). They lived only inside a
hosted database. This folder is where they now live in git.

## How it relates to `supabase/migrations/`

Both are kept. They serve different purposes:

| | `supabase/migrations/` | `supabase/applied-history/` |
|---|---|---|
| Content | hand-authored working copies + drizzle baseline | verbatim record of what ran |
| Comments | fuller — the design rationale lives here | as applied |
| Ordering | `0000`–`00NN`, curated | database version, authoritative |
| Rebuilds the DB | no | yes |

Where a file appears in both, the SQL is the same: of the 45 pairs that match by
name, **42 are byte-identical once comments are stripped**. The size differences
are documentation, not behaviour.

## Known drift — 3 files

These three hand-authored files no longer match what is deployed. The local copy
was edited after it had already been applied, so the repo and the database
disagree. Treat the `applied-history/` copy as the truth about production:

- `0040_pdc_lifecycle.sql`
- `0049_ask_stock_overdue.sql`
- `0057_ask_analysis_reports.sql`

## Rebuilding from scratch

Replay this folder in filename order against an empty database. There is no
squashed baseline: `20260514202438_initial_schema.sql` is the real beginning.

## The longer-term fix

This split is a workaround, not a destination. The durable fix is to pick one
tool and re-baseline:

1. Point drizzle's `out` at its own directory (e.g. `drizzle/`) so it stops
   writing into `supabase/`.
2. Make `supabase/migrations/` a genuine Supabase CLI directory seeded from this
   folder, then `supabase link` the project so `db push` and `db reset` work.
3. Stop applying migrations through the dashboard, which is what caused the
   divergence in the first place.

Until that happens, **this folder is the only complete record.**
