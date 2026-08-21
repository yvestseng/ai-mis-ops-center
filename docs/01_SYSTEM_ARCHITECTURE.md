# 01 System Architecture

```text
Browser
  ├─ /user/*  User Service Portal
  └─ /admin/* Admin Operations Portal
           |
           v
Cloudflare Worker (worker/index.ts)
  ├─ Auth / RBAC
  ├─ Ticket APIs
  ├─ Classification / Priority
  ├─ Governance / Reviews / KPI
  ├─ Support Teams
  ├─ Surveys
  └─ Security Middleware
           |
           v
Cloudflare D1
  ├─ app_users / roles / auth_sessions
  ├─ tickets / ticket_events
  ├─ priority rules
  ├─ classification reviews
  ├─ audit_logs / login_attempts
  └─ migrations
```

## Source Layout
- `app/`: UI / routes
- `worker/`: API / domain services
- `db/`: Drizzle schema
- `drizzle/`: migrations
- `tests/`: regression/source tests
- `scripts/`: build, validation, smoke, rollback, packaging
- `docs/`: handover/runbooks
