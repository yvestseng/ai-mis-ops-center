# AI MIS OPS Center — P2 Department Scope Regression Fix

Date: 2026-08-29
Basis: v0.6.2 Service Feedback Governance Integration candidate

## Production smoke defect

Input:

`採購所有同仁今天都無法連線部門共用系統，但全公司其他單位沒有問題。`

Before fix:
- Impact: `company_wide`
- Priority: `P1`

Expected:
- Impact: `department`
- Priority: `P2`

## Root cause

The semantic normalization correctly recognized `採購所有同仁` as a department-wide scope, but the later phrase `全公司其他單位沒有問題` contained `全公司`. The broad-scope rule treated this negative boundary statement as positive company-wide evidence and overrode the department scope.

## Fix

`worker/ticket-classification.ts` now detects an explicitly unaffected rest-of-company boundary when a real department scope is already present. Phrases such as `全公司其他單位沒有問題`, `公司其他部門皆正常`, `其餘單位未受影響`, and equivalent supported forms suppress the broad-company promotion for that sentence.

The guard only activates when both conditions are true:
1. a real department scope is detected; and
2. the rest of the company/other units are explicitly described as unaffected or normal.

True company-wide outage wording continues to resolve to `company_wide` / P1.

## Regression coverage

Added `tests/department-scope-negative-company-boundary.test.mjs` with:
- the exact production smoke sentence;
- three department-boundary variants;
- two true company-wide P1 controls.

Focused boundary tests: 14/14 PASS.
Source regression in supplied archive after restoring v0.6.2 baseline config files: 131 PASS, 0 FAIL, 1 SKIP (132 total; rendered artifact test skips until a build is generated).

## Database / migration impact

None. No D1 schema or migration changes are required.

## Deployment note

This package is a review/fix artifact. Re-run the repository's normal install, lint, build, full regression and production smoke gates in the authoritative working tree before committing, tagging, pushing, or deploying.
