# AI MIS OPS Center v0.6.0 — Production Release Evidence

## Release Identity

- Version: `v0.6.0`
- Release Date: `2026-08-21`
- Branch: `main`
- Git Commit: `a6d7f12eae9eb9080fa4e5ee674e5449a5803fbb`
- Git Tag: `v0.6.0`
- Production URL: `https://ai-mis-ops-center.amtran.workers.dev`
- Production Worker Version ID: `ab6c2f55-e254-4533-a68e-bc8e496cf885`

## Verification Results

| Verification | Result |
|---|---|
| npm ci | PASS |
| Source Tests | 29 / 29 PASS |
| Lint | PASS |
| Build | PASS |
| Artifact Validation | PASS |
| Full Regression | 104 / 104 PASS |
| Production Smoke Test | 18 / 18 PASS |
| Git working tree at release | CLEAN |
| Git main / origin/main | SYNCHRONIZED |
| Pending D1 migrations | 0 |

## Production Smoke Test

Production Smoke Test completed successfully:

`18 / 18 PASS`

Verified:

- User login page
- Admin login page
- Admin login via Admin Portal
- User login via User Portal
- User rejected by Admin Portal
- Admin rejected by User Portal
- Admin session role
- Admin workspace
- Classification Review
- Classification Quality
- Review Queue API
- Quality KPI API
- Support Teams API
- P1 Priority Diagnose
- User session role
- Admin logout
- Admin session invalidation
- User logout

## D1 Database Release Evidence

Database:

`site-creator-d1`

Database ID:

`62274d37-7a11-427e-83bd-0dd7e3b66ba5`

Pre-Migration Bookmark:

`00000136-00000000-000050ce-cf07183dfceb2ad5d3832631f87e8777`

Applied Migrations:

- `0028_company_all_wifi_outage_alias.sql`
- `0029_company_network_degradation_priority.sql`
- `0030_password_hash_hardening.sql`

Post-Migration Bookmark:

`00000137-00000006-000050ce-8897b9f218352c9c498be07f644d89e5`

Post-release migration status:

`No migrations to apply`

## Production Deployment

Worker:

`ai-mis-ops-center`

Production Version ID:

`ab6c2f55-e254-4533-a68e-bc8e496cf885`

Deployment Status:

`SUCCESS`

## Final Release Package

Release ZIP:

`ai-mis-ops-center-v0.6.0-20260821-223330.zip`

SHA256:

`972C55DAD61F4F8762A229DA8FCC0591920C7FA6834B8C1029D206CEB1F99863`

SHA256 independently verified after package generation:

`PASS`

## Rollback Reference

Application rollback reference:

- Git Tag: `v0.6.0`
- Release Commit: `a6d7f12eae9eb9080fa4e5ee674e5449a5803fbb`
- Worker Version: `ab6c2f55-e254-4533-a68e-bc8e496cf885`

Database rollback point before v0.6.0 migrations:

`00000136-00000000-000050ce-cf07183dfceb2ad5d3832631f87e8777`

Database post-release reference:

`00000137-00000006-000050ce-8897b9f218352c9c498be07f644d89e5`

Rollback must follow:

`docs/08_ROLLBACK_RUNBOOK.md`

## Closure Status

- 可驗證：PASS
- 可追溯：PASS
- 可維護：PASS
- 可回滾：PASS
- 可交接：PASS
- Production Ready：PASS
- Handover Ready：PASS

Final Release Status:

**PRODUCTION RELEASED / HANDOVER READY / CLOSURE READY**
