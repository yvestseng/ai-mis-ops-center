# 07 Deployment Runbook

## 1. Source Freeze
```powershell
git status
git log -1 --oneline
```

## 2. Clean Verification
```powershell
npm ci
npm run test:source
npm run lint
npm run build
npm run validate:artifact
npm test
```

## 3. Record D1 Bookmark
```powershell
npx wrangler d1 time-travel info site-creator-d1
```

## 4. Apply Migration
```powershell
npx wrangler d1 migrations list site-creator-d1 --remote
npx wrangler d1 migrations apply site-creator-d1 --remote
```

## 5. Deploy
使用專案既有正式 Release 流程或經核准的 Wrangler deploy。

## 6. Record Evidence
至少記錄：
- version
- Git full SHA
- Git tag
- migration list/state
- D1 pre-deploy bookmark
- Worker Version ID
- deploy timestamp
- validation results

## 7. Production Smoke
執行 `scripts/Production-Smoke-Test.ps1`。

## 8. Package
```powershell
.\scripts\New-Final-Release-Package.ps1
```

保存 ZIP + SHA256。
