---
name: security-review
description: Review or modify AI MIS OPS Center authentication, RBAC, API endpoints, input handling, secrets, audit logging, security headers, or AI-assisted high-risk actions.
---

# Security review

Use this skill for security-sensitive changes and as a focused review before production release when auth/API behavior changed.

## Review boundaries
Inspect the relevant path through:
- `worker/security.ts`;
- `worker/auth.ts`;
- `worker/admin.ts` or affected API module;
- `worker/index.ts` route wiring;
- session/role fields in `db/schema.ts`;
- related tests in `tests/`.

## Mandatory checks
### Authentication/session
- passwords are never logged or returned;
- password hashes/salts/tokens are not exposed;
- session expiry/revocation remains enforced;
- first-login password-change semantics remain intact;
- login failure handling does not leak account existence unnecessarily.

### Authorization
- every privileged write endpoint checks server-side permission/role;
- admin UI visibility is not treated as authorization;
- user and admin login paths remain correctly separated;
- ID-based routes do not permit horizontal/vertical privilege escalation.

### Request security
Preserve the project-wide API protections routed through:
- `validateApiRequest(request)`;
- `securityHeaders(request, response)`.

For new endpoints, ensure they are wired through the same guarded response path.

Validate:
- HTTP method;
- JSON/input shape;
- string lengths and enum values;
- identifiers;
- state transitions;
- authorization before mutation.

### Output/error safety
- return stable user-safe messages;
- log server errors without returning stack traces;
- do not expose secrets, internal tokens, password material, or unnecessary PII;
- avoid raw SQL/internal infrastructure leakage.

### Auditability
Security-relevant actions should leave an audit trail when the surrounding module supports it:
- login/auth changes;
- role/permission changes;
- user status changes;
- priority/classification overrides;
- administrative data changes.

### AI safety
Treat model output as untrusted.
AI must not directly:
- disable accounts;
- change privileges;
- delete production data;
- execute arbitrary SQL/PowerShell/shell;
- alter firewall/network/security policy;
- perform irreversible production actions.

Require deterministic validation and human confirmation for high-risk operations.

## Secrets
Never write real values from:
- `.dev.vars`;
- environment bindings;
- API keys;
- Cloudflare credentials;
- database credentials;
- session tokens;
into tracked files, fixtures, prompts, release records, or client responses.

## Verification
Run focused security/RBAC tests plus normal repository gates.

When reviewing without edits, classify findings by severity and cite the exact file/behavior. Do not weaken an existing control simply to remove a failing test.
