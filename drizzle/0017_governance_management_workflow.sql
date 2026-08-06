-- Governance data management: explicit lifecycle metadata and operator permissions.
ALTER TABLE major_incidents ADD COLUMN supervisor_name TEXT;
--> statement-breakpoint
ALTER TABLE major_incidents ADD COLUMN supervisor_email TEXT;
--> statement-breakpoint
ALTER TABLE major_incidents ADD COLUMN closure_summary TEXT;
--> statement-breakpoint
ALTER TABLE major_incident_notifications ADD COLUMN recipient_name TEXT;
--> statement-breakpoint
ALTER TABLE major_incident_notifications ADD COLUMN recipient_email TEXT;
--> statement-breakpoint
ALTER TABLE major_incident_notifications ADD COLUMN notification_status TEXT NOT NULL DEFAULT 'recorded';
--> statement-breakpoint
UPDATE roles
SET permissions = json_insert(permissions, '$[#]', 'knowledge.manage'), updated_at = CURRENT_TIMESTAMP
WHERE code IN ('admin', 'operator') AND json_valid(permissions)
  AND NOT EXISTS (SELECT 1 FROM json_each(roles.permissions) WHERE value = 'knowledge.manage');
--> statement-breakpoint
UPDATE roles
SET permissions = json_insert(permissions, '$[#]', 'governance.import'), updated_at = CURRENT_TIMESTAMP
WHERE code IN ('admin', 'operator') AND json_valid(permissions)
  AND NOT EXISTS (SELECT 1 FROM json_each(roles.permissions) WHERE value = 'governance.import');
