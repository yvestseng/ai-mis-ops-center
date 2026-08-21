# 14 Release Evidence Template

> 此檔是 Template，不代表已部署。Production Release 完成後建立新的 evidence 檔案並填入實際值。

## Release Identity
- Application Version:
- Git Branch:
- Git Full SHA:
- Git Tag:
- Release Date/Time (Asia/Taipei):
- Operator:

## Verification
- npm ci:
- test:source:
- lint:
- build:
- validate:artifact:
- npm test:
- Secret scan:

## D1
- Database:
- Pre-release Time Travel bookmark:
- Migration list before:
- Migration applied:
- Migration list after:

## Worker
- Worker Name:
- Worker Version ID:
- Deployment ID:
- Deploy status:

## Production Smoke
- Base URL:
- User portal:
- Admin portal:
- Cross-portal negative:
- Session role:
- Classification Review:
- Classification KPI:
- P1 Diagnose:
- Logout/session invalidation:
- Final result:

## Rollback
- Known-good Git Tag/SHA:
- Known-good Worker Version ID:
- D1 recovery bookmark:
- Rollback dry-run:
- Rollback owner/approver:

## Delivery
- ZIP filename:
- SHA256:
