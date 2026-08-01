CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_hash_uq` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_expires_idx` ON `auth_sessions` (`user_id`,`expires_at`);--> statement-breakpoint
ALTER TABLE `app_users` ADD `username` text;--> statement-breakpoint
ALTER TABLE `app_users` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `app_users` ADD `password_salt` text;--> statement-breakpoint
ALTER TABLE `app_users` ADD `password_changed_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_username_uq` ON `app_users` (`username`);