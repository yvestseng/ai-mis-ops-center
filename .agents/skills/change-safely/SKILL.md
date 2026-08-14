---
name: change-safely
description: Safely modify AI MIS OPS Center code for bug fixes, UI/API behavior, governance workflows, or feature changes. Use when implementing code changes; do not use for release/deploy-only tasks.
---

# Change safely

Follow this workflow for normal implementation work.

## 1. Establish scope
- Restate the requested behavior internally as a small acceptance target.
- Inspect the current implementation before editing.
- Read directly related tests and database fields/rules.
- If Git is available, inspect `git status` and `git diff`. Preserve unrelated user edits.

## 2. Trace the behavior end-to-end
For ticket/governance bugs, trace:
`app UI -> worker route -> business rule -> D1 query/write -> schema/migration -> tests`.

Do not patch only the visible symptom if a shared source of truth is wrong.

Examples:
- Preview priority differs from created ticket: find the rule source and make preview/use-path consistent.
- Impact confirmation updates UI but not review data: trace payload, persistence fields, API response, and reviewer query.
- Admin navigation page missing: verify route/page, authorization, navigation entry, and rendered source tests.

## 3. Implement narrowly
- Change the minimum coherent set of files.
- Reuse existing helpers and conventions.
- Avoid broad renaming/refactoring during a bug fix.
- Do not alter `.before-*` backup files.
- Do not add a production dependency unless required by the task.

## 4. Preserve contracts
Check:
- field names match between UI, API, `db/schema.ts`, and SQL;
- server-side RBAC remains authoritative;
- status and priority labels remain canonical;
- error responses remain user-safe;
- audit/security paths are preserved;
- database-driven rules are not replaced with duplicated frontend constants.

## 5. Add a regression test
Add or update a focused test under `tests/`.
A good regression test fails on the old behavior and passes on the fix.

Prefer:
- source-contract tests for route/RBAC/security invariants;
- API/business-rule tests for priority/classification;
- deterministic fixture-driven tests for governance baselines.

## 6. Validate
Run the narrow test first, then the repository gates available in the checkout.

Typical project gates:
```bash
npm run lint
npm run build
npm test
```

Use the actual scripts in `package.json` when present. Build currently delegates through `scripts/build-verified.sh`, and Cloudflare builds may intentionally skip the OpenAI Sites manifest check.

## 7. Report
Summarize:
- root cause;
- files changed;
- test added/updated;
- validation commands and results;
- anything not verified.

Do not commit, push, migrate remote D1, or deploy unless the user explicitly requests that release action.
