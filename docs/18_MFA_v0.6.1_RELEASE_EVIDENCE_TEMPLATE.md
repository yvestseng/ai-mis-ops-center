# AI MIS OPS Center v0.6.1 — Release Evidence

> Fill this document only with real release outputs. Do not paste secrets, passwords, TOTP codes, recovery codes, TOTP seeds, encryption keys or session cookies.

## Release identity

- Release: `v0.6.1 — Security Hardening / TOTP MFA`
- Base commit: `7657a97 fix: classify department-wide outages as P2`
- Release commit: `TBD`
- Tag: `TBD`
- Production Worker Version ID: `TBD`
- Release date/time: `TBD`

## Scope evidence

Expected changed areas:

- `worker/auth.ts`
- `worker/mfa.ts`
- `worker/index.ts`
- `worker/admin.ts`
- `db/schema.ts`
- `drizzle/0031_totp_mfa_hardening.sql`
- `app/portal-gate.tsx`
- `app/admin-data-console.tsx`
- `app/globals.css`
- `scripts/production-smoke-test.mjs`
- `scripts/Production-Smoke-Test.ps1`
- `tests/mfa-security-hardening.test.mjs`
- MFA documentation
- `package.json` / generated `package-lock.json`

P1/P2/P3/P4, classification, assignment and SLA logic must have no intentional changes.

## Validation evidence

- MFA focused test: `TBD`
- Full regression test count: `TBD`
- Full regression pass: `TBD`
- Lint: `TBD`
- Build: `TBD`

Development package baseline evidence before repository dependency install:

- `node --experimental-strip-types --test tests/*.test.mjs`
- `126 tests / 126 pass / 0 fail`

## D1 migration evidence

- Target binding: `DB`
- Target database name: `site-creator-d1`
- Migration: `0031_totp_mfa_hardening.sql`
- Remote apply output: `TBD`

## Secret configuration evidence

Record only status, never the value:

- `MFA_ENCRYPTION_KEY` configured: `TBD (Yes/No)`
- Secret command completed successfully: `TBD`

## Production verification

- `/admin/login` password stage: `TBD`
- Admin MFA challenge: `TBD`
- Admin TOTP verification: `TBD`
- Admin privileged API access after MFA: `TBD`
- Privileged access denied before MFA: `TBD`
- Ordinary user login: `TBD`
- Recovery-code one-time test: `TBD`
- MFA reset/re-enrollment: `TBD`
- Audit events reviewed: `TBD`
- Production smoke overall: `TBD`

## Rollback evidence

- Previous known-good commit/version: `TBD`
- Application rollback command/version: `TBD`
- D1 destructive rollback required: `No — 0031 is additive`

## Closure judgement

- 可驗證: `TBD`
- 可追溯: `TBD`
- 可維護: `TBD`
- 可回滾: `TBD`
- 可交接: `TBD`
