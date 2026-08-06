-- Correct overly broad P1 matching and add the Exchange / SMTP P2 rule.
-- P1 must be based on verified business impact, never a generic word such as "Server".
UPDATE ticket_priority_rules
SET
  rule_name = 'P1－全公司重大服務中斷',
  description = '僅在明確描述全公司、全廠、主要據點或大量使用者受影響時套用。單一 Server、Exchange 或 SMTP 異常不得判為 P1。',
  match_all_terms = '[]',
  match_any_terms = '["全公司","全廠","主要據點","大量使用者受影響"]',
  priority = '緊急',
  category = '網路連線',
  assigned_team = '網路維運組',
  priority_review_required = 1,
  require_impact_details = 1,
  display_order = 10,
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system'
WHERE id = 'priority-p1-major-outage';
---> statement-breakpoint
INSERT INTO ticket_priority_rules
  (id, rule_name, description, match_all_terms, match_any_terms, priority, category, assigned_team, priority_review_required, require_impact_details, display_order, is_active, created_at, created_by, updated_at, updated_by)
VALUES
  ('priority-p2-exchange-smtp', 'P2－Exchange／SMTP 郵件服務故障', 'Exchange、Mail Server 或 SMTP 無法傳送、接收或轉遞郵件，且尚未明確為全公司重大服務中斷時套用。', '["exchange|mail server|smtp|郵件伺服器|郵件服務","fail|failed|failure|error|down|無法寄信|無法收信|無法傳送|無法轉遞"]', '[]', '高', 'Microsoft 365', '系統維運組', 1, 1, 40, 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system')
ON CONFLICT(id) DO UPDATE SET
  rule_name = excluded.rule_name,
  description = excluded.description,
  match_all_terms = excluded.match_all_terms,
  match_any_terms = excluded.match_any_terms,
  priority = excluded.priority,
  category = excluded.category,
  assigned_team = excluded.assigned_team,
  priority_review_required = excluded.priority_review_required,
  require_impact_details = excluded.require_impact_details,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system';
