-- Expand P1 company-wide Wi-Fi vocabulary for wording where the quantity
-- appears before the wireless service name, such as "公司所有 Wi-Fi 一直斷線".
-- The worker still requires serviceState=outage and broad impact before P1 can match.
UPDATE ticket_priority_rules
SET
  description = '明確描述全公司、全廠、主要據點、大量使用者、所有人員／同仁／使用者皆受影響，或公司所有／全部／全數 Wi-Fi 與無線網路中斷，且同時辨識為實際 outage/failure 時套用。部門內全員、單一 AP、單一設備、單一使用者或未確認影響範圍的故障不得直接判為 P1。',
  match_any_terms = '["全公司","全廠","主要據點","大量使用者受影響","所有使用者受影響","所有人員","全部人員","全體人員","所有同仁","全部同仁","所有使用者","全部使用者","全體使用者","公司網路全部中斷","公司網路全面中斷","全公司網路中斷","全公司無法上網","公司全面斷網","公司WIFI全部中斷","公司WiFi全部中斷","公司Wi-Fi全部中斷","全公司WIFI中斷","全公司WiFi中斷","全公司Wi-Fi中斷","公司無線網路全部中斷","公司無線網路全面中斷","全公司無線網路中斷","公司無線網全部斷線","全公司無法連WiFi","全公司無法連線WiFi","公司所有WiFi斷線","公司所有Wi-Fi斷線","公司全部WiFi斷線","公司全部Wi-Fi斷線","公司所有無線網路斷線","公司全數WiFi無法連線"]',
  priority_review_required = 1,
  require_impact_details = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system'
WHERE id = 'priority-p1-major-outage';
