-- Separate service requests from incidents before the P3 incident fallback.
-- The application also performs semantic work-type classification; this
-- migration keeps the administrator-visible P4 rule aligned with that engine.
UPDATE ticket_priority_rules
SET
  description = '一般服務申請：Office／AutoCAD 等軟體安裝或申請、設備申請、帳號／權限申請、功能與改善建議。故障、失敗、無法使用等異常事件不套用此規則。',
  match_any_terms = '[
    "帳號申請|申請帳號|開通帳號",
    "權限申請|申請權限|開通權限|新增權限|存取權限",
    "軟體安裝|安裝軟體|我要安裝|需要安裝|協助安裝|Office|AutoCAD|Adobe",
    "軟體申請|申請軟體|軟體需求|授權申請",
    "設備申請|申請設備|申請筆電|申請電腦|更換設備|更換電池",
    "功能建議|改善建議|優化建議|建議新增|希望增加|希望新增"
  ]',
  priority = '低',
  priority_review_required = 0,
  require_impact_details = 0,
  display_order = 100,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system'
WHERE id = 'priority-p4-request';