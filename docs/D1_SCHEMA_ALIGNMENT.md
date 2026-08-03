# D1 Schema Alignment Rollout

This branch repairs drift between the committed Drizzle migrations, `db/schema.ts`, and the Worker runtime SQL used by authentication, tickets, and admin APIs.

## What Changed

- `drizzle/0003_rainy_komodo.sql` now adds the authentication columns to `app_users` before creating `app_users_username_uq`.
- `drizzle/0004_schema_alignment.sql` creates `support_teams`, adds ticket assignment columns, creates `login_attempts`, and replaces the legacy survey daily unique index with the current `system_usage` per-user rule.
- `db/schema.ts` now includes `login_attempts` so rate-limit storage is part of the formal schema.

## Preflight Checks For Existing D1 Databases

Before applying this to an existing remote D1 database, check whether the runtime compatibility code has already added any columns:

```sql
PRAGMA table_info('app_users');
PRAGMA table_info('tickets');
PRAGMA index_list('survey_responses');
SELECT id, name, applied_at FROM d1_migrations ORDER BY id;
```

The normal path is safe for databases that have only applied the committed migrations. If an existing database already has some of the columns added manually or by runtime repair, reconcile that database before applying the migration because SQLite/D1 does not support `ALTER TABLE ADD COLUMN IF NOT EXISTS`.

## Expected Post-Migration Shape

`app_users` should include:

- `username`
- `team_id`
- `is_assignable`
- `password_hash`
- `password_salt`
- `password_changed_at`

`tickets` should include:

- `assigned_team_id`
- `assigned_user_id`
- `ai_suggested_team_id`
- `assignment_source`
- `assigned_at`

The database should also include:

- `support_teams`
- `login_attempts`
- `survey_responses_system_user_uq`

## Follow-Up

After this rollout is confirmed in local and remote D1, reduce `worker/auth.ts` schema repair to a narrow startup guard. The migration files should remain the source of truth for production schema changes.
