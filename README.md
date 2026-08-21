# AI MIS OPS Center

AI MIS OPS Center 是企業內部資訊報修與 MIS 維運治理系統，核心包含工單、P1～P4 優先級判斷、AI/規則式分類、人工覆核、分類品質 KPI、RBAC、SLA、Audit 與正式部署驗證流程。

## 目前版本

- Application Version: **0.6.0**
- Runtime: Cloudflare Workers + D1
- Node.js: >= 22.13
- Package manager: npm / package-lock.json
- Production Worker: `ai-mis-ops-center`
- D1: `site-creator-d1`

> 0.6.0 是 2026-08-21 Final Hardening source baseline。正式 Production Release 的 Git SHA、Worker Version ID、D1 bookmark、Smoke Test 結果必須在部署後寫入 Release Evidence，不應在原始碼中預先偽造。

## 快速驗證

```powershell
npm ci
npm run test:source
npm run lint
npm run build
npm run validate:artifact
npm test
```

## Local Development

不要把密碼或 Token 寫入 Git。複製 `.env.example` / 自行建立 `.dev.vars`，正式交付 ZIP 會排除 `.dev.vars`。

```powershell
npm ci
npm run dev
```

## Database Migration

```powershell
npx wrangler d1 migrations list site-creator-d1 --remote
npx wrangler d1 migrations apply site-creator-d1 --remote
```

最新 Hardening Migration：

- `0030_password_hash_hardening.sql`

此 migration 增加 `password_algorithm` 與 `password_iterations`。舊帳號保留 PBKDF2-SHA256 / 10,000 metadata；成功登入後自動提升到目前 target 100,000 iterations。

## Production Smoke Test

```powershell
$AdminPassword = Read-Host "Admin password" -AsSecureString
$UserPassword  = Read-Host "User password" -AsSecureString

.\scripts\Production-Smoke-Test.ps1 `
  -BaseUrl "https://ai-mis-ops-center.amtran.workers.dev" `
  -AdminId "admin01" `
  -AdminPassword $AdminPassword `
  -UserId "user01" `
  -UserPassword $UserPassword
```

Smoke Test 驗證：

1. User/Admin Login Page
2. User/Admin 正向登入
3. User → Admin Portal 拒絕
4. Admin → User Portal 拒絕
5. Session Role
6. Admin Workspace
7. Classification Review
8. Classification Quality KPI
9. Support Team API
10. P1 Diagnose
11. Logout
12. Logout 後 Session 失效

## Release Package

```powershell
.\scripts\New-Final-Release-Package.ps1
```

輸出 ZIP 與 SHA256，並排除 `.dev.vars`、`.env*`、`.before-*`、local D1、logs、node_modules 等非交付物。

## Rollback

先讀 `docs/08_ROLLBACK_RUNBOOK.md`。Rollback script 預設 Dry Run：

```powershell
.\scripts\Rollback-AiMisOpsCenter.ps1 -WorkerVersionId "<known-good-version-id>"
```

確認後才加 `-Execute`。若 D1 schema/data 也需要回復，必須先取得核准 bookmark，並理解 D1 restore 會覆寫現有資料。

## 文件索引

- `docs/00_PROJECT_OVERVIEW.md`
- `docs/01_SYSTEM_ARCHITECTURE.md`
- `docs/02_LOCAL_DEVELOPMENT.md`
- `docs/03_DATABASE_AND_MIGRATIONS.md`
- `docs/04_AUTH_AND_RBAC.md`
- `docs/05_PRIORITY_CLASSIFICATION_RULES.md`
- `docs/06_AI_GOVERNANCE.md`
- `docs/07_DEPLOYMENT_RUNBOOK.md`
- `docs/08_ROLLBACK_RUNBOOK.md`
- `docs/09_PRODUCTION_SMOKE_TEST.md`
- `docs/10_OPERATIONS_RUNBOOK.md`
- `docs/11_TROUBLESHOOTING.md`
- `docs/12_SECURITY_CHECKLIST.md`
- `docs/13_HANDOVER_CHECKLIST.md`

## Definition of Done

正式結案不是「功能都做完」，而是同時符合：

- 可驗證：Requirement → Test → Result
- 可追溯：Git SHA → Migration → Build → Worker Version → Test Evidence
- 可維護：Git main 為唯一 Source of Truth
- 可回滾：Known Good → Worker rollback → D1 recovery → Smoke Test
- 可交接：新 MIS Engineer 可依文件 Build / Deploy / Maintain / Troubleshoot / Rollback
