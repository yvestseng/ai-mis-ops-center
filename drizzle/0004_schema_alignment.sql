CREATE TABLE IF NOT EXISTS `support_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`team_code` text NOT NULL,
	`team_name` text NOT NULL,
	`description` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `support_teams_code_uq` ON `support_teams` (`team_code`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `support_teams_active_order_idx` ON `support_teams` (`is_active`,`display_order`);--> statement-breakpoint
INSERT OR IGNORE INTO `support_teams`
(`id`,`team_code`,`team_name`,`description`,`display_order`,`is_active`)
VALUES
('team-service-desk','SERVICE_DESK','MIS 服務台','第一線資訊服務與工單分派窗口',10,1),
('team-network','NETWORK','網路維運組','核心網路、VPN、無線網路與線路維運',20,1),
('team-security','SECURITY','資安監控組','資安事件監控、弱點追蹤與資安治理',30,1),
('team-applications','APPLICATIONS','應用系統組','企業內部系統、ERP 與 SaaS 服務維運',40,1);
--> statement-breakpoint
ALTER TABLE `app_users` ADD `username` text;--> statement-breakpoint
ALTER TABLE `app_users` ADD `team_id` text;--> statement-breakpoint
ALTER TABLE `app_users` ADD `is_assignable` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `app_users` ADD `password_salt` text;--> statement-breakpoint
ALTER TABLE `app_users` ADD `password_changed_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `app_users_username_uq` ON `app_users` (`username`);--> statement-breakpoint
UPDATE `app_users`
SET `username` = CASE
  WHEN `id` = 'user-owner' THEN 'tw_yves'
  WHEN `id` = 'user-helpdesk' THEN 'mis_helpdesk'
  ELSE lower(substr(`email`, 1, instr(`email`, '@') - 1))
END
WHERE `username` IS NULL;
--> statement-breakpoint
UPDATE `app_users`
SET `team_id` = CASE
  WHEN `role_id` = 'role-user' THEN NULL
  ELSE 'team-service-desk'
END,
`is_assignable` = CASE
  WHEN `role_id` = 'role-user' THEN 0
  ELSE 1
END
WHERE `team_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `tickets` ADD `assigned_team_id` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `assigned_user_id` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `ai_suggested_team_id` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `assignment_source` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `assigned_at` text;--> statement-breakpoint
UPDATE `tickets`
SET `assigned_team_id` = CASE
  WHEN `assigned_team` LIKE '%網路%' THEN 'team-network'
  WHEN `assigned_team` LIKE '%資安%' THEN 'team-security'
  WHEN `assigned_team` LIKE '%應用%' OR `assigned_team` LIKE '%系統%' THEN 'team-applications'
  ELSE 'team-service-desk'
END,
`assignment_source` = COALESCE(`assignment_source`, 'legacy'),
`assigned_at` = COALESCE(`assigned_at`, `created_at`)
WHERE `assigned_team_id` IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`login_key` text NOT NULL,
	`ip_hash` text NOT NULL,
	`succeeded` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `login_attempts_lookup_idx` ON `login_attempts` (`login_key`,`ip_hash`,`created_at`);--> statement-breakpoint
DROP INDEX IF EXISTS `survey_responses_type_device_date_uq`;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `survey_responses_system_user_uq` ON `survey_responses` (`survey_type`,`respondent_hash`) WHERE `survey_type` = 'system_usage';