# 11 Troubleshooting

## Login 400 LOGIN_PORTAL_REQUIRED
呼叫端未傳 `portal=user|admin`。不可移除 server validation；修正 client/test contract。

## Login 403 PORTAL_ROLE_MISMATCH
帳號角色與入口不符。確認使用正確 Portal，不應改前端繞過。

## Login 503 AUTH_SCHEMA
Production D1 尚未套用必要 migration。先查 migrations，禁止直接手改程式忽略欄位。

## Build Fail
先執行 `npm ci`，確認 Node 版本與 lockfile。不可用刪測試方式取得綠燈。

## Classification Regression
執行對應 `tests/*priority*.test.mjs`，確認 normalization 與 impact scope，避免單人事件被提升 P1。
