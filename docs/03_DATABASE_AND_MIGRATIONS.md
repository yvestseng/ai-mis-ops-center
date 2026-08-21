# 03 Database and Migrations

## Database
Cloudflare D1: `site-creator-d1`

## Rules
1. 已套用 migration 不修改內容。
2. Schema 變更新增下一號 migration。
3. Production apply 前先記錄 D1 Time Travel bookmark。
4. Migration、Git SHA、Worker Version ID 必須同批寫入 Release Evidence。

## Commands
```powershell
npx wrangler d1 migrations list site-creator-d1 --remote
npx wrangler d1 time-travel info site-creator-d1
npx wrangler d1 migrations apply site-creator-d1 --remote
```

## 0030 Password Hardening
新增：
- `password_algorithm`
- `password_iterations`

Legacy：PBKDF2-SHA256 / 10,000。
Current target：PBKDF2-SHA256 / 100,000。
成功登入時透明 Rehash。

不可先刪除 legacy 相容邏輯，除非已查證所有 active accounts 都完成升級。
