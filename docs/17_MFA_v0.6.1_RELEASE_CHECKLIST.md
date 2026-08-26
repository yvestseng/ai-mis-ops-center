# v0.6.1 TOTP MFA — Release / Handover Checklist

## Pre-release

- [ ] Base commit is the approved v0.6.0/department-P2 baseline.
- [ ] Diff does not modify P1/P2/P3/P4, classification, assignment or SLA logic.
- [ ] `package.json` is 0.6.1.
- [ ] `package-lock.json` is regenerated after installing `qrcode` / `@types/qrcode`.
- [ ] `0031_totp_mfa_hardening.sql` reviewed as additive.
- [ ] `MFA_ENCRYPTION_KEY` exists as a Cloudflare secret and is not in Git.
- [ ] MFA focused tests pass.
- [ ] Full regression tests pass.
- [ ] Lint passes.
- [ ] Build passes.

## Production release

- [ ] Production D1 binding/database identity verified.
- [ ] 0031 applied to production D1.
- [ ] Cloudflare Worker v0.6.1 deployed.
- [ ] Admin login returns MFA enrollment/challenge.
- [ ] MIS/operator login returns MFA enrollment/challenge.
- [ ] Ordinary user login remains functional.
- [ ] Admin/MIS cannot access privileged API before MFA.
- [ ] TOTP login succeeds.
- [ ] Invalid TOTP is denied.
- [ ] Recovery code succeeds once and fails on reuse.
- [ ] Admin MFA reset revokes sessions and forces re-enrollment.
- [ ] Audit log contains MFA events without secrets/codes.
- [ ] Production smoke test passes.

## Evidence

- [ ] Git commit SHA recorded.
- [ ] Git diff/stat recorded.
- [ ] Test counts recorded.
- [ ] D1 migration output recorded.
- [ ] Worker deployment Version ID recorded.
- [ ] Production smoke result recorded.
- [ ] No password, TOTP secret, encryption key, recovery code or session token is present in evidence.

## Rollback / handover

- [ ] Previous production Worker version/commit identified.
- [ ] Application-only rollback procedure confirmed.
- [ ] MFA break-glass owner identified.
- [ ] MFA reset SOP handed over.
- [ ] Encryption-key rotation warning handed over.
- [ ] Recovery codes are owned by each account holder and stored outside the application/database in approved secure storage.
