# D1 Schema Alignment Rollout

This branch repairs drift between `db/schema.ts` and the currently observed remote D1 database used by the Worker authentication, tickets, and admin APIs.

## Observed Remote D1 State

The remote D1 database has already applied migrations through `0008_security_hardening.sql`.

It already contains these `app_users` columns:

- `username`
- `team_id`
- `is_assignable`
- `password_hash`
- `password_salt`
- `password_changed_at`

It also already contains these `tickets` columns:

- `assigned_team_id`
- `assigned_user_id`
- `ai_suggested_team_id`
- `assignment_source`
- `assigned_at`

It already has `survey_responses_system_user_uq`, so the new migration keeps the index creation idempotent.

Because SQLite/D1 does not support `ALTER TABLE ADD COLUMN IF NOT EXISTS`, the production migration intentionally does not re-add those columns.

## What Changed

- `drizzle/0009_remote_schema_alignment.sql` creates `support_teams`, seeds default teams, backfills existing `app_users` and `tickets`, creates `login_attempts`, and keeps survey unique-index behavior aligned with the current `system_usage` per-user rule.
- `db/schema.ts` now includes `login_attempts` so rate-limit storage is part of the formal schema.

## Preflight Checks For Existing D1 Databases

Before applying this to an existing remote D1 database, run each query separately in the D1 console:

```sql
PRAGMA table_info('app_users');
```

```sql
PRAGMA table_info('tickets');
```

```sql
PRAGMA index_list('survey_responses');
```

```sql
SELECT id, name, applied_at FROM d1_migrations ORDER BY id;
```

## Expected Post-Migration Shape

The database should include:

- `support_teams`
- `login_attempts`
- `survey_responses_system_user_uq`

Existing `app_users` rows with empty `username` should be backfilled. Existing non-user `app_users` and unassigned tickets should be associated with the default `team-service-desk` support team when no better legacy team mapping is available.

## Follow-Up

After this rollout is confirmed in local and remote D1, reduce `worker/auth.ts` schema repair to a narrow startup guard. The migration files should remain the source of truth for production schema changes.
