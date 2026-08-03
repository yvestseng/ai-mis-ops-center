CREATE TABLE IF NOT EXISTS `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`department` text,
	`role_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`username` text,
	`password_hash` text,
	`password_salt` text,
	`password_changed_at` text,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `app_users_email_uq` ON `app_users` (`email`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `app_users_role_status_idx` ON `app_users` (`role_id`,`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_tag` text NOT NULL,
	`name` text NOT NULL,
	`asset_type` text NOT NULL,
	`owner_name` text,
	`department` text,
	`location` text,
	`status` text DEFAULT '使用中' NOT NULL,
	`warranty_end` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `assets_asset_tag_uq` ON `assets` (`asset_tag`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `assets_type_status_idx` ON `assets` (`asset_type`,`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`details` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_actor_created_idx` ON `audit_logs` (`actor_email`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_entity_created_idx` ON `audit_logs` (`entity_type`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `managed_services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`service_type` text NOT NULL,
	`owner_team` text NOT NULL,
	`status` text DEFAULT '正常' NOT NULL,
	`availability` real DEFAULT 100 NOT NULL,
	`endpoint` text,
	`description` text,
	`last_checked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `managed_services_name_uq` ON `managed_services` (`name`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `managed_services_status_idx` ON `managed_services` (`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`permissions` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `roles_code_uq` ON `roles` (`code`);
--> statement-breakpoint
INSERT OR IGNORE INTO `roles` (`id`,`code`,`name`,`permissions`,`is_system`)
VALUES
('role-admin','admin','系統管理人員','["dashboard.read","tickets.create","tickets.read.own","tickets.read.all","tickets.update","assets.read","assets.write","services.read","services.write","surveys.read","rbac.manage","audit.read"]',1),
('role-operator','operator','MIS 維運人員','["dashboard.read","tickets.create","tickets.read.own","tickets.read.all","tickets.update","assets.read","assets.write","services.read","services.write","surveys.read"]',1),
('role-user','user','一般使用者','["dashboard.read","tickets.create","tickets.read.own","assets.read","services.read"]',1);
--> statement-breakpoint
INSERT OR IGNORE INTO `app_users`
(`id`,`email`,`display_name`,`department`,`role_id`,`status`)
VALUES
('user-owner','tsengs@twmns.com','TW_YVES','資訊部','role-admin','active'),
('user-helpdesk','mis-helpdesk@company.com','MIS Service Desk','資訊部','role-operator','active');
--> statement-breakpoint
INSERT OR IGNORE INTO `assets`
(`id`,`asset_tag`,`name`,`asset_type`,`owner_name`,`department`,`location`,`status`,`warranty_end`,`notes`)
VALUES
('asset-demo-001','NB-0123','ZBook 行動工作站','筆記型電腦','TW_YVES','資訊部','台北辦公室','使用中','2027-06-30','管理系統示範設備'),
('asset-demo-002','NET-CORE-01','核心交換器','網路設備',NULL,'資訊部','台北機房','使用中','2028-03-31','核心網路設備');
--> statement-breakpoint
INSERT OR IGNORE INTO `managed_services`
(`id`,`name`,`service_type`,`owner_team`,`status`,`availability`,`description`,`last_checked_at`)
VALUES
('service-m365','Microsoft 365','SaaS','系統維運組','正常',99.99,'Exchange Online、Teams 與 SharePoint Online',CURRENT_TIMESTAMP),
('service-network','公司網路','網路服務','網路維運組','正常',99.98,'核心網路、有線與無線網路',CURRENT_TIMESTAMP),
('service-vpn','VPN Gateway','資安服務','網路維運組','部分異常',98.70,'遠端辦公安全連線服務',CURRENT_TIMESTAMP),
('service-erp','ERP Production','內部系統','應用系統組','正常',99.95,'企業資源管理正式環境',CURRENT_TIMESTAMP);
