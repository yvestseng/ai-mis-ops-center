# 維運團隊與工單轉派功能修改說明

## 新增檔案
- `drizzle/0006_support_team_assignment.sql`
- `worker/support-teams.ts`

## 修改檔案
- `db/schema.ts`
- `worker/auth.ts`
- `worker/admin.ts`
- `worker/index.ts`
- `worker/tickets.ts`
- `app/page.tsx`
- `app/admin-data-console.tsx`
- `app/globals.css`

## 資料庫異動
- 新增 `support_teams`
- `app_users` 新增 `team_id`、`is_assignable`
- `tickets` 新增 `assigned_team_id`、`assigned_user_id`、`ai_suggested_team_id`、`assignment_source`、`assigned_at`
- 新增 `tickets.assign` 權限

## API
- `GET /api/support-teams`
- `GET /api/support-teams/{id}/members`
- `PATCH /api/tickets/{id}` 支援 `assignedTeamId`、`assignedUserId`

## D1 套用
```powershell
npx.cmd wrangler d1 execute site-creator-d1 --remote --file ".\drizzle\0006_support_team_assignment.sql"
```

## 驗證
```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test
```
