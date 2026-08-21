# 04 Auth and RBAC

## Portal Contract
`POST /api/auth/login`

```json
{"username":"...","password":"...","portal":"user|admin"}
```

- User Portal 僅允許 `roleCode=user`
- Admin Portal 僅允許 `admin` / `operator`
- 不合法 portal → `LOGIN_PORTAL_REQUIRED`
- Cross portal → `PORTAL_ROLE_MISMATCH`

## Session
- HttpOnly
- SameSite=Lax
- HTTPS 時 Secure
- DB 僅保存 token hash
- Logout revoke session

## Rate Limit
- 15 分鐘視窗
- 5 次失敗
- 15 分鐘 lock

## Permission
Server-side `requirePermission()` 是最終授權判斷，前端顯示不可取代 API authorization。
