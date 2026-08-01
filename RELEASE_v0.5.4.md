# v0.5.4 發布說明

## 發布內容

- 版本升級至 0.5.4
- Cloudflare compatibility date 固定為 2026-05-22
- `nodejs_compat` 僅在 `wrangler.jsonc` 宣告一次
- 修正本機 LAN IP / localhost CSP 與 Vite HMR
- API 同源、Content-Type 與大小限制
- Production Demo 帳號預設停用
- 登入失敗鎖定與 Session 撤銷
- 安全標頭、統一 API 錯誤與防止 Stack Trace 洩漏
- D1 security migration

## 一鍵發布

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\release.ps1
```

## 發布後驗證

```powershell
npx.cmd wrangler deployments list
curl.exe -I https://ai-mis-ops-center.amtran.workers.dev/
curl.exe https://ai-mis-ops-center.amtran.workers.dev/api/session
```
