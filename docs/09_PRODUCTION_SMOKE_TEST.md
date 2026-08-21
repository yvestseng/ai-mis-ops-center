# 09 Production Smoke Test

## Required Inputs
- BASE_URL
- Admin ID / password
- User ID / password

密碼只透過 SecureString / environment 暫時傳入，不寫入檔案。

## Coverage
- `/user/login` 200
- `/admin/login` 200
- user + user portal PASS
- admin + admin portal PASS
- user + admin portal 403
- admin + user portal 403
- `/api/session` role check
- Admin workspace
- Classification Review
- Classification Quality
- Review queue / KPI API
- Support team API
- P1 diagnose
- Logout
- Session invalidated

Smoke Test 不建立正式工單。
