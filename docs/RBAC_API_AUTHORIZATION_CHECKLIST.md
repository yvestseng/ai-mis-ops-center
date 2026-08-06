# RBAC API Authorization Checklist

| API | Admin | Operator | User |
| --- | --- | --- | --- |
| GET /api/admin/users | 200 | 403 | 403 |
| GET /api/admin/roles | 200 | 403 | 403 |
| GET /api/admin/audit | 200 | 403 | 403 |
| GET /api/admin/teams | 200 | 403 | 403 |
| PATCH /api/tickets/:id | 200 | 200 | 403 |
| GET /api/governance/knowledge-articles | 200 | 200 | 403 |
| POST /api/governance/knowledge-articles | 201 | 201 | 403 |
| PATCH /api/governance/knowledge-articles/:id | 200 | 200 | 403 |
| GET /api/governance/major-incidents | 200 | 200 | 403 |
| POST /api/governance/major-incidents | 201 | 201 | 403 |
| PATCH /api/governance/major-incidents/:id | 200 | 200 | 403 |
| POST /api/governance/major-incidents/:id (notify) | 200 | 200 | 403 |
| GET /api/governance/candidate-tickets | 200 | 200 | 403 |
| POST /api/governance/import-candidates | 200 | 200 | 403 |

Governance creates and changes are recorded in `audit_logs`. Candidate import creates only `草稿` knowledge articles or `待確認重大事件`; Admin or Operator must review before publication or closure.
