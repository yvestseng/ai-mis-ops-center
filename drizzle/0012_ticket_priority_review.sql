-- Risk keyword tickets retain the suggested priority and require MIS confirmation.
ALTER TABLE tickets ADD COLUMN priority_suggestion TEXT;
--> statement-breakpoint
ALTER TABLE tickets ADD COLUMN priority_review_required INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE tickets ADD COLUMN priority_confirmed_by TEXT;
--> statement-breakpoint
ALTER TABLE tickets ADD COLUMN priority_confirmed_at TEXT;
--> statement-breakpoint
ALTER TABLE tickets ADD COLUMN service_interruption TEXT;
--> statement-breakpoint
ALTER TABLE tickets ADD COLUMN impact_scope TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tickets_priority_review_idx
  ON tickets(priority_review_required, priority, created_at);
