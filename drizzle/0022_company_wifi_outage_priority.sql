-- Expand the P1 company-wide outage vocabulary to cover Wi-Fi / wireless wording.
-- The actual P1 decision remains gated by worker/tickets.ts requiring outage state.
-- Single AP failures or single-user Wi-Fi problems therefore do not become P1
-- unless company-wide impact is also explicitly detected.
UPDATE ticket_priority_rules
SET
  description = '明確描述全公司、全廠、主要據點、大量使用者、公司網路或公司 Wi-Fi 全面中斷，且同時辨識為實際 outage/failure 時套用。單一 AP、單一設備、單一使用者或未確認影響範圍的網路故障仍不得直接判為 P1。',
  match_any_terms = '["全公司","全廠","主要據點","大量使用者受影響","公司網路全部中斷","公司網路全面中斷","全公司網路中斷","全公司無法上網","公司全面斷網","公司WIFI全部中斷","公司WiFi全部中斷","公司Wi-Fi全部中斷","全公司WIFI中斷","全公司WiFi中斷","全公司Wi-Fi中斷","公司無線網路全部中斷","公司無線網路全面中斷","全公司無線網路中斷","公司無線網全部斷線","全公司無法連WiFi","全公司無法連線WiFi"]',
  priority_review_required = 1,
  require_impact_details = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system'
WHERE id = 'priority-p1-major-outage';
