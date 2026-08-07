-- Four-layer ticket classification governance: service + impact + priority rule + review.
ALTER TABLE tickets ADD COLUMN classification_service TEXT;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN impact_level TEXT;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN classification_source TEXT;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN classification_confidence REAL;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN priority_rule_name TEXT;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN priority_review_reason TEXT;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN sla_policy_code TEXT;
---> statement-breakpoint

CREATE TABLE IF NOT EXISTS sla_policies (
  id TEXT PRIMARY KEY NOT NULL,
  policy_code TEXT NOT NULL UNIQUE,
  priority TEXT NOT NULL UNIQUE,
  response_target_label TEXT NOT NULL,
  resolution_target_label TEXT NOT NULL,
  response_minutes INTEGER,
  resolution_minutes INTEGER,
  uses_business_hours INTEGER NOT NULL DEFAULT 0,
  escalation_minutes INTEGER,
  escalation_action TEXT NOT NULL,
  scope_description TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);
---> statement-breakpoint
CREATE INDEX IF NOT EXISTS sla_policies_active_priority_idx ON sla_policies(is_active, priority);
---> statement-breakpoint
INSERT INTO sla_policies
  (id, policy_code, priority, response_target_label, resolution_target_label, response_minutes, resolution_minutes, uses_business_hours, escalation_minutes, escalation_action, scope_description, is_active, updated_at, updated_by)
VALUES
  ('sla-p1', 'SLA-P1', '緊急', '15 分鐘', '2 小時', 15, 120, 0, 30, '30 分鐘未回應即通知值班主管', '重大資安事件、全公司服務中斷', 1, CURRENT_TIMESTAMP, 'system'),
  ('sla-p2', 'SLA-P2', '高', '30 分鐘', '4 小時', 30, 240, 0, 60, '1 小時未回應即通知團隊主管', '多位使用者或部門服務中斷', 1, CURRENT_TIMESTAMP, 'system'),
  ('sla-p3', 'SLA-P3', '中', '4 小時', '1 工作日', 240, 480, 1, 480, '8 小時未回應即建立追蹤通知', '單一使用者一般軟硬體問題', 1, CURRENT_TIMESTAMP, 'system'),
  ('sla-p4', 'SLA-P4', '低', '1 工作日', '3 工作日', 480, 1440, 1, 960, '2 工作日未回應即提醒處理團隊', '設備申請、軟體安裝與改善建議', 1, CURRENT_TIMESTAMP, 'system')
ON CONFLICT(priority) DO UPDATE SET
  policy_code=excluded.policy_code,
  response_target_label=excluded.response_target_label,
  resolution_target_label=excluded.resolution_target_label,
  response_minutes=excluded.response_minutes,
  resolution_minutes=excluded.resolution_minutes,
  uses_business_hours=excluded.uses_business_hours,
  escalation_minutes=excluded.escalation_minutes,
  escalation_action=excluded.escalation_action,
  scope_description=excluded.scope_description,
  is_active=excluded.is_active,
  updated_at=CURRENT_TIMESTAMP,
  updated_by='system';
