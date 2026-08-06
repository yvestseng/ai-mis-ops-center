-- Formal D1 records for the Service Governance knowledge base and major incidents.
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT,
  category TEXT NOT NULL DEFAULT '其他',
  status TEXT NOT NULL DEFAULT '草稿',
  review_due_at TEXT,
  published_at TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS knowledge_articles_status_review_idx
  ON knowledge_articles(status, review_due_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS knowledge_article_ticket_links (
  article_id TEXT NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  resolution_outcome TEXT NOT NULL DEFAULT 'used',
  linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, ticket_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS knowledge_article_ticket_links_ticket_idx
  ON knowledge_article_ticket_links(ticket_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS major_incidents (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'P2',
  status TEXT NOT NULL DEFAULT '候選重大事件',
  impact_scope TEXT,
  incident_commander TEXT,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS major_incidents_status_severity_idx
  ON major_incidents(status, severity, opened_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS major_incident_ticket_links (
  incident_id TEXT NOT NULL REFERENCES major_incidents(id) ON DELETE CASCADE,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (incident_id, ticket_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS major_incident_ticket_links_ticket_idx
  ON major_incident_ticket_links(ticket_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS major_incident_notifications (
  id TEXT PRIMARY KEY NOT NULL,
  incident_id TEXT NOT NULL REFERENCES major_incidents(id) ON DELETE CASCADE,
  notified_by TEXT NOT NULL,
  note TEXT,
  notified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS major_incident_notifications_incident_idx
  ON major_incident_notifications(incident_id, notified_at);
--> statement-breakpoint
-- Keep formal governance access aligned with the existing Admin / Operator roles.
UPDATE roles
SET permissions = json_insert(permissions, '$[#]', 'knowledge.read', '$[#]', 'incidents.read', '$[#]', 'incidents.manage'),
    updated_at = CURRENT_TIMESTAMP
WHERE code IN ('admin', 'operator')
  AND json_valid(permissions)
  AND NOT EXISTS (SELECT 1 FROM json_each(roles.permissions) WHERE value = 'knowledge.read');
--> statement-breakpoint
UPDATE roles
SET permissions = json_insert(permissions, '$[#]', 'incidents.read'), updated_at = CURRENT_TIMESTAMP
WHERE code IN ('admin', 'operator') AND json_valid(permissions)
  AND NOT EXISTS (SELECT 1 FROM json_each(roles.permissions) WHERE value = 'incidents.read');
--> statement-breakpoint
UPDATE roles
SET permissions = json_insert(permissions, '$[#]', 'incidents.manage'), updated_at = CURRENT_TIMESTAMP
WHERE code IN ('admin', 'operator') AND json_valid(permissions)
  AND NOT EXISTS (SELECT 1 FROM json_each(roles.permissions) WHERE value = 'incidents.manage');
