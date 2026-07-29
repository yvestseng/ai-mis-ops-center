# 權限管理－維運團隊與派工成員

本版本新增完整後台功能：

- 使用者與角色：建立帳號、角色切換、啟用停用、密碼重設
- 角色權限：RBAC 權限勾選與即時儲存
- 維運團隊：新增、修改、排序、啟用、停用、刪除保護
- 派工成員：設定所屬團隊與是否可接受工單指派
- 稽核紀錄：所有團隊、使用者與權限異動寫入 audit_logs

## API

- GET/POST `/api/admin/teams`
- PATCH/DELETE `/api/admin/teams/:id`
- GET/PATCH `/api/admin/users/:id`

## 安全規則

- 所有管理 API 需要 `rbac.manage`
- 已有使用者或工單關聯的團隊不直接刪除，會自動停用
- 一般使用者不可被設定為派工成員
- 停用帳號不可接受派工

## 整合方式

將壓縮檔內容覆蓋到專案根目錄後執行：

```powershell
$env:npm_config_script_shell = "C:\Program Files\Git\bin\bash.exe"
npm.cmd run lint
npm.cmd run build
npm.cmd test
```

然後提交及部署 Cloudflare。
