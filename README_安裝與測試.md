# USER 評分入口顯示修正版 v1.2

本版修正一般使用者工單已結案後，因 Session 權限未同步而看不到「立即評分」的問題。

## 核心修正

- 前端只要 `roleCode === "user"`，已解決／已結案／已關閉且未評分的工單就顯示評分入口。
- MIS 維運人員與系統管理員仍不顯示評分入口。
- 後端只允許 `roleCode === "user"` 提交 IT 服務評分。
- 後端仍強制驗證：
  - 工單必須屬於登入者
  - 工單必須已解決、已結案或已關閉
  - 每張工單只能評分一次

## 安裝

覆蓋：
- app/page.tsx
- worker/surveys.ts
- worker/auth.ts
- app/admin-data-console.tsx

執行：

```powershell
Set-Location "D:\碩士班\ai-mis-ops-center-main"

npx.cmd wrangler d1 execute site-creator-d1 `
  --remote `
  --file ".\drizzle\0005_fix_survey_role_permissions.sql"

npm.cmd run lint
npm.cmd run build
npm.cmd test
```

部署後登出再登入 `user01` 測試。已結案且尚未評分的本人工單應顯示「立即評分」。
