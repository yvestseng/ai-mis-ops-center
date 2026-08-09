-- Classification Governance review store.
-- suggested_* is immutable source-of-truth captured from the AI/rule engine.
-- final_* is populated only by MIS review and is used for KPI evaluation.
CREATE TABLE IF NOT EXISTS ticket_classification_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_id TEXT NOT NULL,

  suggested_work_type TEXT NOT NULL,
  suggested_service_key TEXT NOT NULL,
  suggested_team_id TEXT,
  suggested_priority TEXT NOT NULL,
  suggested_impact_level TEXT NOT NULL,
  suggested_service_state TEXT NOT NULL,
  suggested_confidence REAL NOT NULL,
  suggested_review_required INTEGER NOT NULL DEFAULT 0 CHECK (suggested_review_required IN (0, 1)),

  final_work_type TEXT,
  final_service_key TEXT,
  final_team_id TEXT,
  final_priority TEXT,
  final_impact_level TEXT,

  review_result TEXT CHECK (review_result IN ('accepted', 'modified')),
  work_type_correct INTEGER CHECK (work_type_correct IN (0, 1)),
  priority_correct INTEGER CHECK (priority_correct IN (0, 1)),
  service_correct INTEGER CHECK (service_correct IN (0, 1)),
  team_correct INTEGER CHECK (team_correct IN (0, 1)),
  impact_correct INTEGER CHECK (impact_correct IN (0, 1)),
  overall_correct INTEGER CHECK (overall_correct IN (0, 1)),

  review_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (suggested_team_id) REFERENCES support_teams(id),
  FOREIGN KEY (final_team_id) REFERENCES support_teams(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ticket_classification_reviews_ticket_uq
  ON ticket_classification_reviews(ticket_id);

CREATE INDEX IF NOT EXISTS ticket_classification_reviews_reviewed_idx
  ON ticket_classification_reviews(reviewed_at, review_result);

CREATE INDEX IF NOT EXISTS ticket_classification_reviews_priority_idx
  ON ticket_classification_reviews(suggested_priority, final_priority);

CREATE INDEX IF NOT EXISTS ticket_classification_reviews_service_idx
  ON ticket_classification_reviews(suggested_service_key, final_service_key);

-- Capture the original recommendation at the exact moment the ticket is inserted.
-- SQLite triggers execute in the same statement/transaction scope as the ticket INSERT,
-- so a newly created ticket and its governance snapshot cannot drift apart.
-- The explicit POST capture API remains available for legacy tickets created before
-- this migration; new tickets will already have their immutable review row.
CREATE TRIGGER IF NOT EXISTS ticket_classification_reviews_capture_after_ticket_insert
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
    CASE WHEN NEW.priority = '低' THEN 'request' ELSE 'incident' END,
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
    CASE
      WHEN NEW.priority = '緊急' THEN 'outage'
      ELSE 'unknown'
    END,
    COALESCE(NEW.classification_confidence, 0),
    COALESCE(NEW.priority_review_required, 0),
    NEW.created_at,
    NEW.created_at
  );
END;
