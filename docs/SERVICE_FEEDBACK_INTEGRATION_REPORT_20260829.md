# Service Feedback Integration Report

## 1. Current Source of Truth

- Main response table: `survey_responses`
- Per-question answers: `survey_answers`
- Improvement follow-up: `survey_followups`
- Ticket relation: `tickets.ticket_number = survey_responses.ticket_reference`
- Engineer source: `survey_responses.engineer_name`, originally derived from `tickets.assigned_user_id -> app_users`
- Existing endpoint: `/api/surveys`
- Existing user UI: Ticket Detail -> SERVICE FEEDBACK

Decision: SAME SOURCE + DUPLICATE UI. No second feedback model was created.

## 2. Original Data Flow

User Ticket Detail -> POST `/api/surveys` (`surveyType=it_service`) -> `worker/surveys.ts` -> `survey_responses` + `survey_answers` -> optional `survey_followups`.

The former Governance -> IT Personnel Service Survey form used the same POST endpoint but duplicated the submission UI. Admin/operator submission was already rejected server-side because only `roleCode=user` may submit IT service feedback.

## 3. Problem Found

The system persisted feedback correctly but management only received aggregate counts/average score. There was no management read API for individual feedback records, per-engineer KPI details, or pending follow-up records. Therefore submitted scores such as 5/5/4 could not be inspected from the management UI.

## 4. Architecture Decision

Reuse the existing Service Feedback model as the sole Source of Truth.

`survey_responses` -> management read queries -> Dashboard / Records / Low-score Follow-up.

No materialized duplicate feedback data was introduced.

## 5. Files Changed

- `worker/surveys.ts`
- `app/workspace-home.tsx`
- `app/globals.css`
- `tests/service-feedback-integration.test.mjs` (new)
- `docs/SERVICE_FEEDBACK_INTEGRATION_REPORT_20260829.md` (new)

## 6. Schema Changes

NO DATABASE MIGRATION REQUIRED.

Existing database constraints already provide one-feedback-per-ticket protection through `survey_responses_ticket_reference_uq`.

## 7. API Changes

Existing `/api/surveys` GET handler now supports management read views:

- `GET /api/surveys?view=summary`
- `GET /api/surveys?view=records&page=1&pageSize=20`
- `GET /api/surveys?view=followups&page=1&pageSize=20`

Records support date, engineer, score, resolved-status and priority filters.

Management read access follows the existing governance boundary: admin or identities carrying the existing `tickets.update` management permission, while retaining compatibility with existing survey read permissions.

## 8. UI Changes

Governance -> IT Personnel Service Survey is changed from a duplicate submission form into three management views:

1. Service Quality Dashboard
2. Service Survey Records
3. Low-score Improvement Follow-up

The records view shows ticket, ticket title, evaluator (derived from ticket requester), engineer, three scores, average score, resolution state, comment, priority/status and submission time.

## 9. RBAC Verification

- IT service feedback submission remains restricted by the existing server-side rule to general users.
- Management read views require admin or the existing management permission boundary.
- No parallel RBAC system or new role table was introduced.

## 10. Duplicate Feedback Protection

Existing protection remains unchanged:

1. Application-level check for an existing `it_service` response by ticket reference.
2. Database UNIQUE constraint on `survey_responses.ticket_reference`.
3. SQLite UNIQUE conflict is translated to HTTP 409 DUPLICATE_SUBMISSION.

## 11. Low-score Rule

The existing rule was preserved exactly:

- any of response/expertise/communication `< 3`, OR
- `resolvedStatus !== "是"`

then `needs_followup=true` and a pending `survey_followups` row is created.

## 12. Test Results

Focused Service Feedback regression:

- 4 / 4 PASS

Full source test run:

- Total: 130
- PASS: 124
- FAIL: 6

The six failures are archive-baseline/environment failures caused by files referenced by existing tests but missing from the uploaded ZIP:

- `vite.config.ts`
- `wrangler.jsonc`
- `postcss.config.mjs`

No failure in the new Service Feedback regression test.

Lint:

- BLOCKED: uploaded archive has no `node_modules`; eslint executable is unavailable.

Build:

- NOT VERIFIED: dependency/runtime environment is incomplete in the uploaded archive; bounded build did not complete within the available validation window.

Database migration review:

- PASS: no migration added.

Remote D1:

- NOT TOUCHED.

Git commit/push/deploy:

- NOT PERFORMED.

## 13. Manual Verification Steps

### user01

1. Log in to user portal.
2. Open an own ticket with status Resolved/Closed.
3. Submit 5 / 5 / 4 and resolved=Yes.
4. Reopen the ticket and verify `已完成服務評分`.
5. Attempt to submit again and verify duplicate submission is prevented.

### admin01

1. Log in to admin portal.
2. Open Service Governance -> IT Personnel Service Survey.
3. Verify the default Service Quality Dashboard.
4. Open Service Survey Records and locate the newly submitted ticket.
5. Verify the 5 / 5 / 4 scores, requester, engineer, comment and submission time.
6. Use date/engineer/score/resolution/priority filters.

### Low-score follow-up

1. Use a different eligible resolved ticket.
2. Submit one score below 3 (for example 5 / 2 / 5), or choose Partially Resolved/No.
3. Log in as admin/MIS.
4. Open Service Governance -> IT Personnel Service Survey -> Low-score Improvement Follow-up.
5. Verify the ticket and reason appear in the pending list.

## 14. Risk / Remaining Work

Before release, re-run lint/build/full regression from the complete repository working tree containing the normal configuration files and installed dependencies.

The ticket-number action in the new management table should also be manually checked against the deployed application's preferred ticket-detail navigation behavior before release.

## 15. Final Status

IMPLEMENTATION COMPLETE IN PROVIDED WORKING COPY.

VALIDATION BLOCKED BY INCOMPLETE UPLOADED ARCHIVE.

Not declared Production PASS and not declared READY FOR REVIEW until lint/build/full regression are clean in the complete local repository.
