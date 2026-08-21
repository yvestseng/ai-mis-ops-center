# AI MIS OPS Center Final Hardening Changes — 2026-08-21

依據 `AI_MIS_OPS_Center_程式與網站完整評審報告_2026-08-21` 收斂，不新增新 Feature。

## P0 完成項目

### P0-01 Production Smoke Test Contract
- Login payload 補上 `portal`
- User/Admin 正向登入
- User → Admin 403
- Admin → User 403
- Session role
- Admin governance pages/APIs
- P1 diagnose
- Logout + session invalidation

### P0-02 Password Hash Hardening
- 新增 `password_algorithm`
- 新增 `password_iterations`
- 新密碼 PBKDF2-SHA256 target 100,000 iterations
- Legacy 10,000 帳號相容
- 成功登入透明 Rehash
- Demo seed 不再覆蓋已升級 password hash
- Create user / Reset password / Change password 同步 metadata

> 100,000 是基於原 Source 已註明 150,000 在 Hosted Worker runtime 曾失敗後的 bounded baseline。未來應以 Worker CPU benchmark 或 Entra ID 遷移再提高。

### P0-03 Traceability
- Version 升至 0.6.0
- 移除舊 `release-output`，避免 8/18 evidence 被誤認為 8/21 source release
- 新增 Release Evidence Template
- 新增 clean package + SHA256 script

### P0-04 Rollback
- 新增 `Rollback-AiMisOpsCenter.ps1`
- 預設 Dry Run
- Worker known-good version rollback
- 可選 D1 Time Travel bookmark restore
- 新增 Rollback Runbook

## P1 完成項目
- 移除 `.before-*`
- 移除 `.dev.vars` / disabled vars
- 移除 stale dist
- 新增主 README
- 新增 Architecture / Local Dev / DB / Auth / Classification / AI Governance
- 新增 Deployment / Rollback / Smoke / Operations / Troubleshooting / Security / Handover 文件
- Artifact validator 改為 Cloudflare/OpenAI Sites 兩種 packaging 均可驗證
- Test command 明確使用 Node Type Stripping

## 驗證結果
- Source tests: 29/29 PASS
- Full regression with `node --experimental-strip-types --test tests/*.test.mjs`: 104/104 PASS
- TypeScript syntax transpile check (`worker/auth.ts`, `worker/admin.ts`, `db/schema.ts`): PASS
- `npm ci`: 此隔離環境 dependency download timeout，未宣稱 PASS
- 因 `npm ci` 未完成，本環境無法可靠執行 lint/build/validate:artifact；必須於可連 npm registry 的乾淨 Runner 完成最後 Gate。

## Production 注意
本交付包是 **Source Hardening Baseline**，不是已部署 Production Evidence。
正式上線前必須：
1. npm ci / lint / build / validate / test 全 PASS
2. 記錄 D1 bookmark
3. apply migration 0030
4. deploy
5. 記錄 Git SHA / Tag / Worker Version ID
6. Production Smoke PASS
7. 產生 final ZIP + SHA256
