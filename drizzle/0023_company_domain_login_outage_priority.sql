-- Expand the P1 company-wide outage vocabulary to cover AD / domain authentication outages.
-- The Worker still requires explicit company-wide impact plus outage state before P1 applies,
-- so a single user's or single computer's domain-login problem remains below P1.
UPDATE ticket_priority_rules
SET
  description = '明確描述全公司、全廠、主要據點、大量使用者、公司網路、公司 Wi-Fi 或全公司 AD／網域登入服務全面中斷，且同時辨識為實際 outage/failure 時套用。單一設備、單一使用者或未確認影響範圍的登入／網域故障仍不得直接判為 P1。',
  match_any_terms = '["全公司","全廠","主要據點","大量使用者受影響","公司網路全部中斷","公司網路全面中斷","全公司網路中斷","全公司無法上網","公司全面斷網","公司WIFI全部中斷","公司WiFi全部中斷","公司Wi-Fi全部中斷","全公司WIFI中斷","全公司WiFi中斷","全公司Wi-Fi中斷","公司無線網路全部中斷","公司無線網路全面中斷","全公司無線網路中斷","公司無線網全部斷線","全公司無法連WiFi","全公司無法連線WiFi","公司電腦都無法登入網域","全公司電腦無法登入AD","所有員工都無法登入網域","全公司無法登入網域","全公司無法登入Active Directory"]',
  priority_review_required = 1,
  require_impact_details = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system'
WHERE id = 'priority-p1-major-outage';
