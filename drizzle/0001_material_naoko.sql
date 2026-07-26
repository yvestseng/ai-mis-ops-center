CREATE TABLE `ticket_events` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`actor_name` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ticket_events_ticket_created_idx` ON `ticket_events` (`ticket_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_number` text NOT NULL,
	`requester_hash` text NOT NULL,
	`requester_name` text NOT NULL,
	`requester_email` text NOT NULL,
	`department` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`priority` text NOT NULL,
	`source` text NOT NULL,
	`location` text,
	`asset_tag` text,
	`assigned_team` text NOT NULL,
	`status` text DEFAULT '待處理' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_ticket_number_uq` ON `tickets` (`ticket_number`);--> statement-breakpoint
CREATE INDEX `tickets_requester_created_idx` ON `tickets` (`requester_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `tickets_status_priority_idx` ON `tickets` (`status`,`priority`);