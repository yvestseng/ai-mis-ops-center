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

  final_work_type TEXT,
  final_service_key TEXT,
  final_team_id TEXT,
  final_priority TEXT,
  final_impact_level TEXT,

  review_result TEXT CHECK (review_result IN ('accepted', 'modified')),
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
