# AI MIS Ops Center v0.5.3 完整修正報告

## 本版已修正

- 補齊完整 Vite、Vinext、Next.js、TypeScript、Wrangler、ESLint、Drizzle 與環境範例設定。
- `nodejs_compat` 僅保留於 `wrangler.jsonc`，避免 Miniflare 重複旗標錯誤。
- Compatibility Date 固定為本機 runtime 可支援的 `2026-05-22`。
- 移除 CSP 的 `upgrade-insecure-requests`，避免以 localhost、LAN IP 或 APIPA IP 開發時只剩初始 SSR 畫面。
- 開發環境允許 Vite HMR WebSocket；正式環境縮限連線來源。
- 所有 API 套用 CSP、HSTS、NoSniff、防 iframe、Permissions Policy 與 No-store。
- API 新增跨來源異動阻擋、Content-Type 驗證及實際 256 KB Body 上限。
- 未知 API 統一回傳 JSON 404；未攔截例外統一回傳安全的 500 訊息。
- 正式環境預設禁止 Demo 帳號；本機開發可使用 `?demo=1` 顯示測試角色。
- 登入連續失敗 5 次鎖定 15 分鐘；成功登入會清除該帳號與來源 IP 的舊失敗紀錄。
- 密碼至少 8 碼並包含大小寫字母、數字與特殊符號。
- 停用帳號、角色異動與密碼重設會撤銷既有 Session。
- 移除原始 ZIP 中 `.before-*` 備份檔，避免 lint、搜尋及維護混淆。
- 新增 `npm run clean:dev` 與設定防回歸測試。

## Windows 本機啟動

```powershell
cd "D:\碩士班\ai-mis-ops-center-main"

npm.cmd install
npm.cmd run clean:dev
npm.cmd run test:source
npm.cmd run dev
```

瀏覽器請先使用：

```text
http://localhost:5173/
```

測試角色登入頁：

```text
http://localhost:5173/?demo=1
```

## 正式部署前

```powershell
$env:npm_config_script_shell = "C:\Program Files\Git\bin\bash.exe"
npm.cmd run lint
npm.cmd run build
npx.cmd wrangler d1 migrations apply site-creator-d1 --remote
npx.cmd wrangler deploy
```

正式環境必須維持：

```json
"AUTH_ALLOW_DEMO": "false"
```
