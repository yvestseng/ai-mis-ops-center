-- Keep historical rules aligned with the canonical P1 / P2 / P3 / P4 display names.
UPDATE ticket_priority_rules
SET rule_name = 'P3－中等服務異常',
    description = '一般使用者服務異常的預設分類。此規則不含關鍵字，僅供管理者參考。',
    updated_at = CURRENT_TIMESTAMP,
    updated_by = 'system'
WHERE id = 'priority-p3-default-service';
