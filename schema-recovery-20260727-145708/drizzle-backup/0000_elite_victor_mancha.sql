CREATE TABLE `survey_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`response_id` text NOT NULL,
	`question_code` text NOT NULL,
	`answer_value` text NOT NULL,
	`numeric_score` real,
	FOREIGN KEY (`response_id`) REFERENCES `survey_responses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `survey_answers_response_question_uq` ON `survey_answers` (`response_id`,`question_code`);--> statement-breakpoint
CREATE INDEX `survey_answers_response_idx` ON `survey_answers` (`response_id`);--> statement-breakpoint
CREATE TABLE `survey_followups` (
	`id` text PRIMARY KEY NOT NULL,
	`response_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`assigned_to` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`response_id`) REFERENCES `survey_responses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `survey_followups_response_uq` ON `survey_followups` (`response_id`);--> statement-breakpoint
CREATE INDEX `survey_followups_status_idx` ON `survey_followups` (`status`);--> statement-breakpoint
CREATE TABLE `survey_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_key` text NOT NULL,
	`survey_type` text NOT NULL,
	`respondent_hash` text NOT NULL,
	`submission_date` text NOT NULL,
	`ticket_reference` text,
	`engineer_name` text,
	`resolved_status` text,
	`overall_score` real NOT NULL,
	`nps_score` integer,
	`comment` text,
	`needs_followup` integer DEFAULT false NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `survey_responses_submission_key_uq` ON `survey_responses` (`submission_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `survey_responses_type_device_date_uq` ON `survey_responses` (`survey_type`,`respondent_hash`,`submission_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `survey_responses_ticket_reference_uq` ON `survey_responses` (`ticket_reference`);--> statement-breakpoint
CREATE INDEX `survey_responses_type_date_idx` ON `survey_responses` (`survey_type`,`submitted_at`);