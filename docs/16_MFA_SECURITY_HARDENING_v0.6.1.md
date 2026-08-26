# AI MIS OPS Center v0.6.1 — TOTP MFA Security Hardening

## 1. Scope freeze

v0.6.1 only hardens authentication. It does **not** change ticket P1/P2/P3/P4 rules, classification, assignment, SLA policy, or ticket workflow.

Security scope:

- existing username/password authentication remains;
- `/user/login` and `/admin/login` remain distinct;
- `admin` and `operator` (MIS) roles require TOTP MFA;
- ordinary `user` role keeps the existing password-only flow in v0.6.1;
- Microsoft Authenticator and Google Authenticator compatible `otpauth://` enrollment;
- QR Code rendered locally by the application;
- one-time recovery codes;
- MFA audit events;
- server-side MFA enforcement on privileged sessions;
- first-login password change, account disable, logout, RBAC and existing security headers remain enforced.

## 2. Authentication state machine

```text
username + password
  -> invalid / disabled: DENY
  -> portal/role mismatch: DENY
  -> Admin/MIS + must_change_password=1:
       restricted session (mfa_verified=0)
       -> password change only
       -> all sessions revoked
       -> login again
  -> ordinary user:
       normal session (existing behavior)
  -> Admin/MIS + MFA not enrolled:
       no full application session
       -> short-lived hashed MFA challenge
       -> encrypted TOTP secret + QR/manual enrollment
       -> verify 6-digit TOTP
       -> enable MFA + issue recovery codes once
       -> full session with mfa_verified=1
  -> Admin/MIS + MFA enrolled:
       no full application session
       -> short-lived hashed MFA challenge
       -> TOTP or unused recovery code
       -> full session with mfa_verified=1
```

A privileged session is accepted only when both RBAC and MFA requirements pass. MFA never adds permissions or changes roles.

## 3. Cryptography and secret handling

### TOTP

- RFC 6238 compatible TOTP
- HMAC-SHA1 (authenticator interoperability)
- 6 digits
- 30-second period
- verification window: ±1 time step
- `last_totp_step` prevents reuse/replay of an already accepted TOTP step

### TOTP secret at rest

TOTP seeds are encrypted with AES-GCM before being written to D1.

Stored in D1:

- `secret_ciphertext`
- `secret_iv`
- `secret_version`

Not stored in source or D1:

- `MFA_ENCRYPTION_KEY`

The key must be provided as a Cloudflare Worker secret and must decode to exactly 32 bytes.

### Recovery codes

- 10 codes are generated after first successful enrollment;
- each code is shown only in the enrollment response;
- D1 stores only an HMAC-SHA256 hash keyed by `MFA_ENCRYPTION_KEY`;
- `used_at` makes each recovery code single use.

## 4. Database migration

Forward migration:

`drizzle/0031_totp_mfa_hardening.sql`

Adds:

- `auth_sessions.mfa_verified`
- `auth_sessions.mfa_verified_at`
- `auth_sessions.mfa_method`
- `user_mfa_settings`
- `user_mfa_recovery_codes`
- `auth_mfa_challenges`

The migration is additive. It does not drop or rewrite ticket, classification, SLA, RBAC, or user data.

Existing privileged sessions receive `mfa_verified=0`; after v0.6.1 is deployed they are rejected by the server-side MFA gate and must authenticate again.

## 5. API changes

### `POST /api/auth/login`

Ordinary user:

- success: HTTP 200 + session cookie

Admin/MIS:

- password valid + MFA challenge: HTTP 202
- no full session cookie before MFA

### `POST /api/auth/mfa/verify`

Input:

- `challengeToken`
- either `code` (TOTP) or `recoveryCode`

Success:

- creates a session with `mfa_verified=1`
- enrollment success returns recovery codes once

### `POST /api/admin/users/:id/mfa-reset`

- requires `rbac.manage` server-side;
- only applies to `admin` or `operator` users;
- deletes MFA setting and recovery codes;
- invalidates pending MFA challenges;
- revokes active sessions;
- next login requires MFA enrollment again;
- creates `mfa_reset` audit evidence.

All new `/api/*` paths still pass through `validateApiRequest(...)` and `securityHeaders(...)`.

## 6. Audit evidence

Security events include:

- `mfa_enroll_started`
- `mfa_enabled`
- `mfa_verify_success`
- `mfa_verify_failed`
- `mfa_recovery_used`
- `mfa_reset`
- `login_mfa_verified`
- `login_password_change_required`

Secrets, recovery codes and TOTP values are not written into audit details.

## 7. Verification gates

Focused MFA regression test:

```powershell
node --experimental-strip-types --test tests/mfa-security-hardening.test.mjs
```

Full source/regression suite:

```powershell
node --experimental-strip-types --test tests/*.test.mjs
```

Expected baseline for this package:

- 126 tests
- 126 pass
- 0 fail

Before production release, also run the repository build/lint gates on the real checkout:

```powershell
$env:Path = "C:\Program Files\Git\bin;$env:Path"
npm install
npm run lint
npm run build
npm test
```

`npm install` is required once because v0.6.1 adds the local QR rendering dependency `qrcode` and its TypeScript definitions; commit the resulting `package-lock.json` together with `package.json` before release.

## 8. Cloudflare secret setup

Generate a 32-byte key without placing it in command history:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$MfaKey = [Convert]::ToBase64String($bytes)
$MfaKey | npx wrangler secret put MFA_ENCRYPTION_KEY
Remove-Variable MfaKey
[Array]::Clear($bytes, 0, $bytes.Length)
```

Do not add the key to `wrangler.jsonc`, Git, documentation, screenshots, release evidence, or prompts.

For local development, use an untracked `.dev.vars` only.

## 9. Release order

Recommended production sequence:

1. confirm Git diff contains only v0.6.1 Security Hardening changes;
2. install/update dependency lock;
3. run lint/build/tests;
4. configure `MFA_ENCRYPTION_KEY` Worker secret;
5. apply `0031_totp_mfa_hardening.sql` to the verified production D1 target;
6. deploy v0.6.1 Worker;
7. enroll Admin/MIS MFA through `/admin/login`;
8. save recovery codes securely;
9. run Production Smoke Test with a current Admin TOTP code;
10. capture commit, migration, deploy version ID and smoke evidence.

The migration should be applied before the v0.6.1 application deploy. v0.6.0 tolerates the additive columns/tables, while v0.6.1 intentionally refuses authentication when the required MFA schema is missing.

## 10. Production smoke test

The v0.6.1 smoke test requires a **current** Admin TOTP code; it never auto-enrolls or rotates the TOTP secret.

```powershell
$AdminPassword = Read-Host "Admin password" -AsSecureString
$AdminTotpCode = Read-Host "Current Admin TOTP code" -AsSecureString
$UserPassword = Read-Host "User password" -AsSecureString

.\scripts\Production-Smoke-Test.ps1 `
  -BaseUrl "https://ai-mis-ops-center.amtran.workers.dev" `
  -AdminId "<admin-id>" `
  -AdminPassword $AdminPassword `
  -AdminTotpCode $AdminTotpCode `
  -UserId "<user-id>" `
  -UserPassword $UserPassword
```

The TOTP code is passed only through a temporary environment variable and is removed by the wrapper in `finally`.

## 11. Rollback strategy

### Preferred rollback

Rollback the **application only** to the previous known-good v0.6.0 commit/version. Keep migration 0031 in D1.

Reason:

- 0031 is additive;
- v0.6.0 ignores the new MFA tables/columns;
- avoiding destructive down-migrations protects authentication evidence and reduces rollback risk.

After rollback:

- validate `/user/login` and `/admin/login` using the v0.6.0 smoke procedure;
- preserve `MFA_ENCRYPTION_KEY` until incident review is complete;
- do not delete MFA tables during an emergency rollback.

### Re-deploying v0.6.1

When v0.6.1 is deployed again, existing privileged sessions will still need a valid MFA assurance state. Re-authentication may be required.

## 12. MFA reset / break-glass handover

Normal MFA reset must use the RBAC-protected admin UI/API so an audit record is created.

If every privileged account loses its authenticator/recovery codes, use the organization-approved Cloudflare/D1 break-glass procedure only after identity and change approval are verified. The authorized operator should:

1. record the incident/change ticket;
2. reset MFA rows for exactly one approved privileged account;
3. revoke that account's sessions;
4. have the user immediately re-enroll MFA;
5. verify `mfa_enabled` evidence afterward;
6. close the break-glass record with command/output evidence.

Do not disable the global MFA server gate as a recovery shortcut.

## 13. Encryption-key rotation warning

v0.6.1 uses one active `MFA_ENCRYPTION_KEY`. Rotating it without re-enrollment makes existing encrypted TOTP seeds and recovery-code HMACs unusable.

Therefore key rotation must be a planned security change:

- reset/re-enroll privileged MFA under the new key;
- revoke old sessions;
- verify all privileged accounts;
- keep approval and validation evidence.

Do not casually rotate the key during ordinary deployment.

## 14. Five closure criteria

### 可驗證

- focused MFA tests;
- full regression suite;
- production MFA smoke flow;
- server-side MFA/RBAC checks.

### 可追溯

- ordered migration `0031`;
- audit actions;
- version `0.6.1`;
- release commit/deploy/migration evidence can be captured without storing secrets.

### 可維護

- MFA cryptography/challenge/recovery logic is isolated in `worker/mfa.ts`;
- auth keeps session/RBAC responsibility;
- QR is a local application dependency;
- encryption key is externalized as a Worker secret.

### 可回滾

- migration is additive;
- previous app version can be redeployed without dropping MFA tables;
- emergency rollback does not require destructive D1 changes.

### 可交接

- enrollment, reset, recovery, smoke, deployment order, rollback and key-rotation constraints are documented here;
- Admin UI exposes MFA status and authorized reset action;
- operational secrets are explicitly excluded from documentation and Git.
