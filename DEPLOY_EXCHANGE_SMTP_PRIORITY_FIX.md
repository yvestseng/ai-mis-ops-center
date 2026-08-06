# Exchange／SMTP 優先級修正

此版將 `Exchange mail Server SMTP Fail` 對映為：

- 規則：`P2－Exchange／SMTP 郵件服務故障`
- 優先級：`高`
- 類別：`Microsoft 365`
- 指派團隊：`系統維運組`
- 控制：需要 MIS 覆核，並要求填寫服務中斷狀況及影響範圍

`P1－全公司重大服務中斷` 已移除過於寬鬆的 `Server`、`Core`、`Switch` 關鍵字。P1 只會在內容明確包含「全公司」、「全廠」、「主要據點」或「大量使用者受影響」時命中。

## 部署順序

1. 覆蓋專案檔案。
2. 對正式 D1 執行：

```powershell
npx.cmd wrangler d1 execute site-creator-d1 --remote --file .\drizzle\0015_exchange_smtp_priority_rule.sql
```

3. 驗證規則：

```powershell
npx.cmd wrangler d1 execute site-creator-d1 --remote --command "SELECT id, rule_name, priority, category, assigned_team, match_all_terms, match_any_terms, display_order FROM ticket_priority_rules ORDER BY display_order, id;"
```

4. 驗證、提交、推送與部署 Worker。

## 測試案例

| 輸入 | 預期結果 |
| --- | --- |
| `Exchange mail Server SMTP Fail` | P2 高、Microsoft 365、系統維運組 |
| `全公司 Exchange mail Server SMTP Fail` | P1 緊急、網路維運組 |
| `Core Switch Fibre port fail and dump fail` | P2 高、網路連線、網路維運組 |
