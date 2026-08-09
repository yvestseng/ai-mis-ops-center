-- SLA Runtime foundation.
-- This migration only adds runtime tracking fields and indexes.
-- Backend calculation/update logic will be added in the next step.

ALTER TABLE tickets ADD COLUMN sla_started_at TEXT;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN response_due_at TEXT;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN resolution_due_at TEXT;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN escalation_due_at TEXT;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN first_response_at TEXT;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN resolved_at TEXT;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN sla_response_status TEXT;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN sla_resolution_status TEXT;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN sla_escalation_level INTEGER NOT NULL DEFAULT 0;
---> statement-breakpoint
ALTER TABLE tickets ADD COLUMN sla_last_escalated_at TEXT;
---> statement-breakpoint

CREATE INDEX IF NOT EXISTS tickets_sla_response_due_idx
  ON tickets(sla_response_status, response_due_at);
---> statement-breakpoint
CREATE INDEX IF NOT EXISTS tickets_sla_resolution_due_idx
  ON tickets(sla_resolution_status, resolution_due_at);
---> statement-breakpoint
CREATE INDEX IF NOT EXISTS tickets_sla_escalation_due_idx
  ON tickets(sla_escalation_level, escalation_due_at);
