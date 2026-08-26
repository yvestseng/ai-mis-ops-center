# 09 Production Smoke Test

## Required Inputs

- `BASE_URL`
- Admin ID / password
- **current Admin TOTP code**
- User ID / password

Passwords and the current TOTP code are supplied only through `SecureString` / temporary environment variables. They are removed by the PowerShell wrapper and must never be written into files or release evidence.

## v0.6.1 MFA behavior

The smoke test never enrolls, resets, or rotates an Admin/MIS TOTP secret.

The selected Admin account must already have MFA enrolled. The script:

1. validates username/password through `/api/auth/login`;
2. expects an MFA challenge (HTTP 202) rather than a privileged session cookie;
3. submits the current 6-digit code to `/api/auth/mfa/verify`;
4. continues privileged API checks only after the MFA-verified session is issued.

If the account still requires MFA enrollment, the smoke test fails safely and asks the operator to complete enrollment interactively first.

## Coverage

- `/user/login` 200
- `/admin/login` 200
- user + user portal PASS
- admin + admin portal password PASS + MFA challenge
- Admin current TOTP PASS
- user + admin portal 403
- admin + user portal 403
- `/api/session` role check
- Admin workspace
- Classification Review
- Classification Quality
- Review queue / KPI API
- Support team API
- P1 diagnose
- Logout
- Session invalidated

Smoke Test does not create a production ticket and does not print passwords, TOTP secrets, recovery codes, or session tokens.
