# v0.5.0 安全與品質優化說明

## 已完成

- API 同源檢查、JSON Content-Type 驗證與 256 KB 請求大小限制。
- 統一加入 CSP、HSTS、X-Frame-Options、NoSniff、Referrer-Policy、Permissions-Policy。
- API 回應強制 no-store，網站禁止搜尋引擎索引。
- 登入失敗限制：同帳號及來源 15 分鐘內失敗 5 次，暫停登入 15 分鐘。
- 正式環境 `AUTH_ALLOW_DEMO=false`，不再自動建立 Demo 帳號。
- 本機 Vite 開發預設允許 Demo；登入頁需使用 `?demo=1` 才顯示快速測試帳號。
- 新增及重設密碼改為至少 8 碼，包含大小寫字母、數字與特殊符號。
- 密碼變更、角色變更或帳號狀態變更時撤銷該帳號所有 Session。
- 新增 `0008_security_hardening.sql` migration。
- 補回完整建置設定：package、TypeScript、Vite、Wrangler、ESLint、PostCSS、Next、Drizzle。
- 新增安全來源自動化測試。

## 部署順序

```powershell
cd "專案目錄"
npm.cmd install
npm.cmd run test:source
npm.cmd run lint
npm.cmd run build
npx.cmd wrangler d1 migrations apply site-creator-d1 --remote
npx.cmd wrangler deploy
```

## 正式環境注意事項

- `wrangler.jsonc` 已設定 `AUTH_ALLOW_DEMO=false`，請勿在 Production 改為 true。
- 既有 Demo 帳號若已存在於 D1，請在權限管理頁停用或從資料庫移除。
- 正式企業導入仍建議改用 Microsoft Entra ID/OIDC 與 MFA。
- 部署 migration 前先匯出 D1 備份。
