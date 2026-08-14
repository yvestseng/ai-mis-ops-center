# AI MIS OPS Center — Codex Repository Instructions

## Mission
Maintain and extend AI MIS OPS Center without breaking production behavior, RBAC, authentication, ticket classification/priority governance, Cloudflare D1 data, security controls, or release traceability.

These instructions apply repository-wide. Use the repo-scoped skills in `.agents/skills/` for repeatable workflows.

## Current architecture and source of truth
- Web application: React/Next-style app running through vinext on Cloudflare Workers.
- Worker/API entry point: `worker/index.ts`.
- Application UI: `app/`.
- Database schema: `db/schema.ts`.
- Database adapter: `db/index.ts`.
- Production database currently evidenced by this repository: **Cloudflare D1**, binding name `DB`, accessed through `drizzle-orm/d1`.
- Database migrations: `drizzle/*.sql`.
- Automated tests: `tests/*.test.mjs`.
- Build verification: `scripts/build-verified.sh`.
- Environment wrapper used by project scripts: `scripts/sites-env.sh`.
- Production worker: `ai-mis-ops-center`.
- Production URL: `https://ai-mis-ops-center.amtran.workers.dev`.
- Main production branch: `main`.

Do not assume PostgreSQL is active merely because a task mentions it. Only treat PostgreSQL as an active datastore when the checked-out repository contains a PostgreSQL driver/adapter, connection configuration, migrations, and a task explicitly targets that datastore. Never translate or execute D1/SQLite migrations against PostgreSQL automatically.

## Mandatory working method
1. **Inspect before editing.**
   - Read the relevant UI, worker/API, schema, migration, and tests first.
   - Check `git status` and `git diff` before modifying tracked files when Git metadata is available.
   - Do not overwrite unrelated user changes.
2. **Keep the change narrow.**
   - Fix the requested behavior and directly related tests only.
   - Do not refactor unrelated modules during a bug fix.
3. **Preserve cross-layer consistency.**
   - UI preview, API behavior, D1 rules, schema fields, migrations, and tests must agree.
   - Do not hard-code a frontend classification/priority result when backend behavior is database-driven.
4. **Add regression coverage.**
   - Every bug fix should add or update a focused test when the behavior is testable.
   - Prefer deterministic source/API tests over fragile UI-only assertions.
5. **Validate before proposing release.**
   - Run the narrowest relevant tests first.
   - Before release/commit, run the repository's actual lint/build/test commands discovered from `package.json` or release scripts.
   - Existing project convention is `npm run lint`, `npm run build`, and `npm test`/the repository's test script.
6. **Do not commit, push, migrate production, or deploy just because code is ready.**
   - Treat Git commit/push, remote D1 migration, Cloudflare deploy, and production data changes as release actions.
   - Perform them only when the user explicitly requests the release/publish/deploy step.
   - Before any release action, show or verify the intended diff and validation results.

## Protected behavior
### Authentication and RBAC
- Keep `/admin/login` and `/user/login` role flows distinct.
- Enforce authorization server-side; UI hiding is not authorization.
- Preserve first-login password-change requirements and session revocation semantics.
- Never weaken rate limiting, password hashing, cookie security, CSP/security headers, or audit logging to make a test pass.

### Ticket priority and classification
- Canonical priority labels are `P1`, `P2`, `P3`, `P4` with the project's current Traditional Chinese display labels.
- Database-driven priority/classification rules are authoritative where implemented.
- If UI diagnosis/preview and ticket creation disagree, fix the shared rule/data flow rather than duplicating a new hard-coded rule.
- P1, security-sensitive, low-confidence, or review-required decisions must retain human-review controls when the existing workflow requires them.
- Keep impact confirmation fields synchronized across UI, API, persistence, and review workflows.

### Database and migrations
- Never edit a migration already applied to production to change its meaning. Add a new forward migration.
- Keep `db/schema.ts` aligned with migrations.
- Prefer additive, reversible schema changes; document destructive operations explicitly.
- Do not drop tables/columns or rewrite production data without explicit user approval.
- For D1 remote operations, verify the target database/binding before execution.
- Do not include secrets, access tokens, passwords, production credentials, or local `.dev.vars` values in source, tests, logs, commits, or prompts.

### Security
- All `/api/*` changes must preserve `validateApiRequest(...)` and `securityHeaders(...)` behavior unless a security-specific task explicitly changes them.
- Validate authorization, input shape, output exposure, error handling, and auditability for write endpoints.
- Do not echo internal exceptions, secrets, hashes, tokens, or sensitive infrastructure details to clients.
- Treat AI output as untrusted input. High-risk operations require deterministic validation and human confirmation.

## File conventions
- `app/`: UI/pages/client behavior.
- `worker/`: API routing, authorization, business logic.
- `db/`: Drizzle schema and DB adapter.
- `drizzle/`: ordered forward migrations.
- `tests/`: regression and policy tests.
- `scripts/`: build/release/environment helpers.
- `release-output/`: release evidence; do not fabricate or manually rewrite historical release evidence.

Avoid modifying `.before-*` recovery/backup files unless the task explicitly concerns them.

## Repo-scoped skills
Use these skills when their trigger matches:
- `$change-safely`: inspect → implement narrow change → regression test → validation.
- `$database-migration`: D1/Drizzle schema or migration work; guarded PostgreSQL handling if an active PostgreSQL stack actually exists.
- `$security-review`: auth/RBAC/API/input/secrets/security-header/AI safety review.
- `$production-release`: Git validation, commit/push, D1 migration gating, Cloudflare deployment, and production verification.

## Definition of done
A change is not done merely because it compiles.
For applicable work, completion means:
- requested behavior is implemented;
- UI/API/schema/migration contracts are aligned;
- regression coverage exists;
- relevant tests pass;
- lint/build/test gates pass before release;
- security/RBAC behavior is not weakened;
- no unrelated changes are included;
- release actions, if requested, have traceable evidence and production verification.

When some validation cannot run because required repository files, credentials, network access, or runtime bindings are absent, state exactly what was not verified. Never claim PASS without evidence.
