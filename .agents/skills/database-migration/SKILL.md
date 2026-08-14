---
name: database-migration
description: Safely change AI MIS OPS Center database schema, Cloudflare D1/Drizzle migrations, or database-backed rules. Also applies to PostgreSQL only when the repository actually contains an active PostgreSQL stack.
---

# Database migration safety

## Datastore selection
Current repository evidence identifies Cloudflare D1 as production:
- binding: `DB`;
- adapter: `drizzle-orm/d1`;
- schema: `db/schema.ts`;
- migrations: `drizzle/*.sql`.

Do not infer PostgreSQL from a prompt alone.

Treat PostgreSQL as active only if the current checkout contains all relevant evidence, such as a PostgreSQL driver/ORM adapter, connection configuration, PostgreSQL-specific migrations, and code paths using it.

Never run D1/SQLite SQL against PostgreSQL or PostgreSQL SQL against D1 automatically.

## Before changing schema
1. Inspect `db/schema.ts`.
2. Inspect the latest migrations and any migration that introduced the affected field/table.
3. Search worker/UI/tests for the affected column names.
4. Identify whether production already applied the migration from release or migration evidence.
5. Determine whether the change is additive, data-transforming, or destructive.

## Migration rules
- Applied migrations are immutable historical records. Add a new numbered migration.
- Keep naming sequential with the repository's migration convention.
- Keep `db/schema.ts` consistent with the resulting database shape.
- Create indexes for real query paths, not speculatively.
- Preserve foreign-key behavior.
- Make data backfills explicit.
- For new non-null columns on populated tables, define a safe default/backfill sequence.
- Avoid destructive DDL unless the user explicitly approves it.

## D1 remote safety
Before any remote command:
- confirm worker/project target;
- confirm D1 database name/binding;
- inspect the exact SQL/migration;
- distinguish local from remote execution.

Do not execute a remote migration merely because a migration file was created.

After migration, verify with read-only schema/query checks and then run affected application tests.

## Rule-data changes
Priority, classification, SLA, routing, and governance tables are behavior, not merely data.

When changing them:
- verify ordering/precedence;
- test positive and negative matches;
- ensure UI preview and backend creation use the same effective rules;
- avoid broad keywords that produce false P1/P2 escalation;
- retain human review requirements for high-risk decisions.

## PostgreSQL guardrail
If an active PostgreSQL path is discovered:
- identify its migration tool and schema source first;
- keep PostgreSQL changes isolated from D1 unless an explicit dual-write/migration design exists;
- never assume schema parity;
- require reconciliation tests before proposing dual-database release.

## Required evidence
Report:
- migration filename;
- schema changes;
- backfill/destructive risk;
- local validation result;
- remote migration status (`not run`, `run`, or `verified`);
- rollback/forward-fix approach.

Never report production migration success without command/output evidence.
