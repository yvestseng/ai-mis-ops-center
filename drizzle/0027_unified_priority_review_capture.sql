-- Week W34 governance hardening:
-- 1) persist the exact Production classification inputs used by the D1 engine;
-- 2) rebuild the immutable review trigger so suggested_* is a faithful snapshot.
ALTER TABLE tickets ADD COLUMN classification_work_type TEXT;
ALTER TABLE tickets ADD COLUMN classification_service_state TEXT;

DROP TRIGGER IF EXISTS ticket_classification_reviews_capture_after_ticket_insert;

CREATE TRIGGER ticket_classification_reviews_capture_after_ticket_insert
AFTER INSERT ON tickets
FOR EACH ROW
BEGIN
  INSERT OR IGNORE INTO ticket_classification_reviews (
    id,
    ticket_id,
    suggested_work_type,
    suggested_service_key,
    suggested_team_id,
    suggested_priority,
    suggested_impact_level,
    suggested_service_state,
    suggested_confidence,
    suggested_review_required,
    created_at,
    updated_at
  ) VALUES (
    lower(hex(randomblob(16))),
    NEW.id,
    COALESCE(NULLIF(NEW.classification_work_type, ''), CASE WHEN NEW.priority = '低' THEN 'request' ELSE 'incident' END),
    COALESCE(NULLIF(NEW.classification_service, ''), 'unknown'),
    COALESCE(
      NEW.assigned_team_id,
      (SELECT id FROM support_teams WHERE team_name = NEW.assigned_team LIMIT 1)
    ),
    CASE NEW.priority
      WHEN '緊急' THEN 'P1'
      WHEN '高' THEN 'P2'
      WHEN '中' THEN 'P3'
      WHEN '低' THEN 'P4'
      ELSE NEW.priority
    END,
    COALESCE(NULLIF(NEW.impact_level, ''), 'unknown'),
    COALESCE(NULLIF(NEW.classification_service_state, ''), 'unknown'),
    COALESCE(NEW.classification_confidence, 0),
    COALESCE(NEW.priority_review_required, 0),
    NEW.created_at,
    NEW.created_at
  );
END;
