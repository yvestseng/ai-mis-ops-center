-- Recognize explicit company-wide network outages as P1 while preserving
-- the existing outage-state gate in worker/tickets.ts. Core network failures
-- without explicit company-wide impact continue to match the P2 core-network rule.
UPDATE ticket_priority_rules
SET
  rule_name = 'P1－全公司重大服務中斷',
  description = '明確描述全公司、全廠、主要據點、大量使用者或公司網路全面中斷，且同時辨識為實際 outage/failure 時套用。單一設備或未確認影響範圍的核心網路故障仍依 P2 規則處理。',
  match_any_terms = '["全公司","全廠","主要據點","大量使用者受影響","公司網路全部中斷","公司網路全面中斷","全公司網路中斷","全公司無法上網","公司全面斷網"]',
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
