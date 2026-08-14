-- Add the middle P2 boundary for department-wide and multi-user outages.
-- worker/tickets.ts validates semantic impact scope + outage state before this
-- generic rule may match, so company/site-wide outages stay P1 and single-user
-- or single-device incidents continue to the P3 fallback.
INSERT OR IGNORE INTO ticket_priority_rules
  (id, rule_name, description, match_all_terms, match_any_terms, priority, category, assigned_team,
   priority_review_required, require_impact_details, display_order, is_active,
   created_at, created_by, updated_at, updated_by)
VALUES
  ('priority-p2-department-outage',
   'P2－部門／多人服務中斷',
   '部門範圍或多位使用者發生實際服務中斷時套用。全公司／據點中斷維持 P1；單一設備、單一 AP、單一使用者維持 P3。',
   '[]',
   '["部門","所有使用者受影響","多位","多人","數名","一群","部分使用者","使用者們"]',
   '高',
   '其他',
   'MIS 服務台',
   1,
   1,
   25,
   1,
   CURRENT_TIMESTAMP,
   'system',
   CURRENT_TIMESTAMP,
   'system');

UPDATE ticket_priority_rules
SET
  rule_name = 'P2－部門／多人服務中斷',
  description = '部門範圍或多位使用者發生實際服務中斷時套用。全公司／據點中斷維持 P1；單一設備、單一 AP、單一使用者維持 P3。',
  match_all_terms = '[]',
  match_any_terms = '["部門","所有使用者受影響","多位","多人","數名","一群","部分使用者","使用者們"]',
  priority = '高',
  category = '其他',
  assigned_team = 'MIS 服務台',
  priority_review_required = 1,
  require_impact_details = 1,
  display_order = 25,
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system'
WHERE id = 'priority-p2-department-outage';
