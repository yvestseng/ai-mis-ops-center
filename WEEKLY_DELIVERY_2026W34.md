# AI MIS Ops Center — 2026-W34 Delivery

## Scope completed

### P1 Production Classification Review 可驗收
- Existing `/admin/classification-reviews` workbench retained and verified.
- Existing `/admin/classification-quality` navigation retained and verified.
- Review APIs remain protected by `tickets.update` permission.
- Production smoke test now validates admin login, admin workspace, Review page, Quality page and core governance APIs.

### P2 統一 Priority Evaluation 邏輯
- Ticket diagnosis (`POST /api/tickets/diagnose`) and ticket creation now use the same server-side `buildClassification()` result.
- Client-submitted category / priority / routing values no longer override Production classification.
- Stale preview values are rejected with explicit 409 responses:
  - `STALE_PRIORITY_DIAGNOSIS`
  - `STALE_CATEGORY_DIAGNOSIS`
  - `STALE_ASSIGNMENT_DIAGNOSIS`
  - existing `STALE_IMPACT_DIAGNOSIS`
- This prevents Preview / Creation / D1 evaluation drift.

### P3 Classification Review 治理閉環
- Added migration `0027_unified_priority_review_capture.sql`.
- Tickets now persist exact `classification_work_type` and `classification_service_state` used by the Production evaluator.
- Ticket creation now persists `assigned_team_id` and `ai_suggested_team_id` instead of only the team label.
- Review trigger rebuilt to capture exact immutable suggested snapshot:
  - AI work type
  - service key
  - team id
  - priority
  - impact level
  - service state
  - confidence
  - review-required flag
- Existing MIS final review continues to save final values, modification reason, reviewer and reviewed time without mutating suggested fields.

### P4 Quality Dashboard MVP
- Existing dashboard verified for:
  - Reviewed Count / Captured Count
  - Overall Accuracy
  - Service Accuracy
  - Priority Accuracy
  - P1 Precision / Recall
  - Manual Review Rate
  - AI Acceptance Rate / Human Override interpretation
  - Priority and Service breakdown
  - Weekly KPI trend
  - baseline maturity and sample adequacy

### P5 Release Smoke Test 流程強化
- Added `scripts/production-smoke-test.mjs`.
- Added `scripts/Production-Smoke-Test.ps1` wrapper using a SecureString password input.
- Smoke test checks login, navigation, session, Review API, Quality KPI API, support-team API and a non-mutating P1 Priority diagnosis.
- Credentials are not stored in source code.

## Verification performed in this delivery sandbox

38 targeted governance / classification tests passed.

Full repository `npm run lint/build/test` could not be certified from the uploaded ZIP because root repository files such as `package.json`, `vite.config.ts`, `postcss.config.mjs`, and some docs were not included in the uploaded archive. The uploaded `node_modules` was also installed for Windows and cannot run Linux-native esbuild inside this sandbox.

## Production rollout order

1. Merge/replace source files.
2. Apply D1 migration `0027_unified_priority_review_capture.sql`.
3. Run the repository's normal lint/build/test on the Windows development workstation.
4. Deploy through the existing release procedure.
5. Run Production Smoke Test.
6. Create one test ticket and verify Preview priority equals created ticket priority.
7. Complete one MIS Classification Review and verify Quality Dashboard counters update.

## Smoke test example (PowerShell)

```powershell
$pw = Read-Host "Admin password" -AsSecureString
.\scripts\Production-Smoke-Test.ps1 `
  -BaseUrl "https://ai-mis-ops-center.amtran.workers.dev" `
  -AdminId "admin01" `
  -AdminPassword $pw
```
