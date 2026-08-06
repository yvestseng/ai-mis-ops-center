-- [MODIFIED: priority rule management] Admin-maintained ticket classification rules.
CREATE TABLE IF NOT EXISTS ticket_priority_rules (
  id TEXT PRIMARY KEY NOT NULL,
  rule_name TEXT NOT NULL,
  description TEXT,
  match_all_terms TEXT NOT NULL DEFAULT '[]',
  match_any_terms TEXT NOT NULL DEFAULT '[]',
  priority TEXT NOT NULL,
  category TEXT NOT NULL,
  assigned_team TEXT NOT NULL,
  priority_review_required INTEGER NOT NULL DEFAULT 0,
  require_impact_details INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
---> statement-breakpoint
CREATE INDEX IF NOT EXISTS ticket_priority_rules_active_order_idx
  ON ticket_priority_rules(is_active, display_order);
---> statement-breakpoint
INSERT OR IGNORE INTO ticket_priority_rules
  (id, rule_name, description, match_all_terms, match_any_terms, priority, category, assigned_team, priority_review_required, require_impact_details, display_order, is_active, created_at, created_by, updated_at, updated_by)
VALUES
  ('priority-p1-major-outage', 'P1－全公司重大服務中斷', '僅在明確描述全公司、全廠、主要據點或大量使用者受影響時套用。單一 Server、Exchange 或 SMTP 異常不得判為 P1。', '[]', '["全公司","全廠","主要據點","大量使用者受影響"]', '緊急', '網路連線', '網路維運組', 1, 1, 10, 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
  ('priority-p2-firewall-boot', 'P2－防火牆無法啟動', '防火牆設備無法開機、啟動、上電或運作。', '["防火牆|firewall|fortigate|palo alto","整體無法開機|無法開機|無法啟動|無法上電|無法運作"]', '[]', '高', '資訊安全', '資安管理組', 1, 1, 20, 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
  ('priority-p2-core-network', 'P2－核心網路設備故障', '核心交換器、核心路由器或對外網路主線故障。', '[]', '["Core Switch","核心交換器","Core Router","核心路由器","Fibre port fail","Fiber port fail","dump fail","對外網路中斷","網際網路主線中斷"]', '高', '網路連線', '網路維運組', 1, 1, 30, 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
  ('priority-p2-exchange-smtp', 'P2－Exchange／SMTP 郵件服務故障', 'Exchange、Mail Server 或 SMTP 無法傳送、接收或轉遞郵件，且尚未明確為全公司重大服務中斷時套用。', '["exchange|mail server|smtp|郵件伺服器|郵件服務","fail|failed|failure|error|down|無法寄信|無法收信|無法傳送|無法轉遞"]', '[]', '高', 'Microsoft 365', '系統維運組', 1, 1, 40, 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
  ('priority-p3-default-service', 'P3－中等服務異常', '一般使用者服務異常的預設分類。此規則不含關鍵字，僅供管理者參考。', '[]', '[]', '中', '其他', 'MIS 服務台', 0, 0, 900, 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
  ('priority-p4-request', 'P4－一般申請與建議', '帳號、權限、軟體安裝或功能建議。', '[]', '["帳號申請","權限申請","軟體安裝","功能建議"]', '低', '其他', 'MIS 服務台', 0, 0, 100, 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');
