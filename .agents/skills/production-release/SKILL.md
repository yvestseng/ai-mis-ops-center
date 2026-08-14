---
name: production-release
description: Release AI MIS OPS Center through Git validation, commit/push, database migration gating, Cloudflare deployment, and production verification. Use only when the user asks to commit, push, publish, deploy, release, or update production.
---

# Production release

This is a controlled production workflow. Never skip gates silently.

## 0. Scope and target
Expected production conventions from existing release evidence:
- branch: `main`;
- Cloudflare Worker: `ai-mis-ops-center`;
- production URL: `https://ai-mis-ops-center.amtran.workers.dev`;
- production database: Cloudflare D1 (`site-creator-d1` in existing release evidence);
- D1 binding in code: `DB`.

Verify current config rather than assuming historical values are still correct.

## 1. Repository preflight
If Git metadata is available:
```bash
git status
git diff
git diff --cached
git branch --show-current
```

Rules:
- do not include unrelated worktree changes;
- inspect staged content before commit;
- do not release from an unexpected branch without explicit intent;
- never use destructive reset/clean to make the tree look clean.

## 2. Quality gates
Run the repository's actual commands. Existing project convention is:
```bash
npm run lint
npm run build
npm test
```

`npm run build` may route through `scripts/build-verified.sh`.

All required gates must pass before production deploy. Warnings must be surfaced if meaningful.

## 3. Database gate
Determine whether the code change requires a new migration.

If no migration:
- record `database migration: not required`.

If migration exists:
- inspect SQL;
- ensure `db/schema.ts` agrees;
- run relevant local tests;
- verify target D1 before remote execution;
- execute remote migration only as part of the explicitly requested release;
- verify resulting schema/data with read-only checks.

Never modify an already-applied migration to force production state.

For PostgreSQL, do nothing unless an active PostgreSQL stack is present and the requested release explicitly includes it.

## 4. Commit
Before commit, show/verify staged scope:
```bash
git diff --cached --stat
git diff --cached
```

Use a concise conventional commit that matches the actual change.
Do not fabricate version bumps.

## 5. Push
Push only after local gates pass and commit scope is verified.

Confirm local branch and `origin/main` synchronization as appropriate.

## 6. Cloudflare deployment
Use the repository's release script if present and trusted (for example a checked-in `Release-AiMisOpsCenter.ps1`); otherwise use the exact deploy command defined by the repository configuration.

Do not invent Wrangler flags, database IDs, or account IDs.

Capture:
- application version if defined;
- Git commit;
- Cloudflare deployment/version ID when available;
- production target URL;
- deployment result.

## 7. Production verification
At minimum verify:
- production endpoint reachable;
- changed route/API is available;
- authentication boundary still behaves correctly;
- affected workflow produces expected result;
- no obvious 5xx regression.

For database-backed changes, verify a read-only production query/API result when safe.

## 8. Release evidence
Existing repository history uses `release-output/` records containing:
- app version;
- environment;
- Git branch/commit/message;
- Cloudflare worker/version/target;
- D1 migration state;
- lint/build/tests/Git synchronization;
- deploy time/status.

Do not fabricate or backdate release evidence. Generate it only from actual results or via the existing release tooling.

## Stop conditions
Stop the release and report clearly if:
- lint/build/tests fail;
- staged scope contains unrelated changes;
- migration target is ambiguous;
- production credentials/config are unavailable;
- Cloudflare deployment fails;
- production verification fails.

A failed release gate is not permission to bypass the gate.
