# RBAC API Authorization Checklist

Use this checklist after production deployment or before a security review to confirm that API authorization is enforced by the Worker, not only by hidden UI controls.

## Preconditions

- Test with three separate accounts or browser profiles:
  - `系統管理員`: role code `admin`
  - `MIS 維運人員`: role code `operator`
  - `一般使用者`: role code `user`
- Do not use exposed demo credentials in production. Create fresh temporary users and rotate or disable them after the test.
- Capture each account's `mis_session` cookie from a logged-in browser session.
- Use the production origin, for example `https://ai-mis-ops-center.amtran.workers.dev`.
- Use a real ticket ID created by the一般使用者 account for own-ticket checks.
- Use a second ticket ID created by another account for cross-user ticket checks.

## Recommended Curl Pattern

```bash
curl -i "https://ai-mis-ops-center.amtran.workers.dev/api/admin/users" \
  -H "Cookie: mis_session=<SESSION_COOKIE>"
```

For mutation tests:

```bash
curl -i -X PATCH "https://ai-mis-ops-center.amtran.workers.dev/api/tickets/<TICKET_ID>" \
  -H "Cookie: mis_session=<SESSION_COOKIE>" \
  -H "Content-Type: application/json" \
  --data '{"status":"處理中","assignedTeamId":"team-service-desk"}'
```

## Admin API Matrix

| Role | Request | Expected |
| --- | --- | --- |
| 未登入 | `GET /api/admin/users` | `401` |
| 一般使用者 | `GET /api/admin/users` | `403` |
| 一般使用者 | `GET /api/admin/roles` | `403` |
| 一般使用者 | `GET /api/admin/audit` | `403` |
| 一般使用者 | `GET /api/admin/teams` | `403` |
| 一般使用者 | `PATCH /api/admin/users/:ownUserId` role/status change | `403` |
| 一般使用者 | `DELETE /api/admin/users/:adminUserId` | `403` |
| MIS 維運人員 | `GET /api/admin/users` | `403` |
| MIS 維運人員 | `GET /api/admin/roles` | `403` |
| MIS 維運人員 | `GET /api/admin/audit` | `403` |
| MIS 維運人員 | `GET /api/admin/teams` | `403` |
| MIS 維運人員 | `DELETE /api/admin/users/:adminUserId` | `403` |
| 系統管理員 | `GET /api/admin/users` | `200` |
| 系統管理員 | `GET /api/admin/roles` | `200` |
| 系統管理員 | `GET /api/admin/audit` | `200` |
| 系統管理員 | `GET /api/admin/teams` | `200` |

## Ticket API Matrix

| Role | Request | Expected |
| --- | --- | --- |
| 未登入 | `GET /api/tickets` | `401` |
| 一般使用者 | `GET /api/tickets` | `200`, only own tickets in response |
| 一般使用者 | `GET /api/tickets/:otherUserTicketId` | `404` |
| 一般使用者 | `PATCH /api/tickets/:ticketId` status update | `403` |
| 一般使用者 | `PATCH /api/tickets/:ticketId` with `assignedTeamId` or `assignedUserId` | `403` |
| MIS 維運人員 | `GET /api/tickets` | `200`, all tickets allowed |
| MIS 維運人員 | `PATCH /api/tickets/:ticketId` status update | `200` |
| MIS 維運人員 | `PATCH /api/tickets/:ticketId` with `assignedTeamId` or `assignedUserId` | `200` |
| 系統管理員 | `GET /api/tickets` | `200`, all tickets allowed |
| 系統管理員 | `PATCH /api/tickets/:ticketId` status update | `200` |
| 系統管理員 | `PATCH /api/tickets/:ticketId` with `assignedTeamId` or `assignedUserId` | `200` |

## Account Safety Guards

| Actor | Request | Expected |
| --- | --- | --- |
| 系統管理員 | `PATCH /api/admin/users/:ownUserId` with `{ "status": "disabled" }` | `400 SELF_DISABLE_DENIED` |
| 系統管理員 | `DELETE /api/admin/users/:ownUserId` | `400 SELF_DELETE_DENIED` |
| 系統管理員 | Disable the only active admin | `400 LAST_ADMIN_DENIED` |
| 系統管理員 | Demote the only active admin to non-admin role | `400 LAST_ADMIN_DENIED` |
| 系統管理員 | Disable another non-last admin | `200`, then old session should become `401` or `403` |

## Evidence To Keep

For each run, record:

- Date and deployment version.
- Test account usernames, not passwords.
- Request path, method, role, and status code.
- Any failed response body `error` code.
- Confirmation that disabled users' old cookies no longer work.

## Pass Criteria

- UI-only hiding is not counted as a pass.
- Every restricted API must reject direct HTTP calls with `401` or `403`.
- Cross-user ticket reads for一般使用者 must not reveal the ticket body; `404` is acceptable and preferred.
- Only `admin` may use RBAC/admin-management APIs.
- `operator` may update and assign tickets, but may not administer users, roles, teams, or audit logs unless a future role policy explicitly grants those permissions.
