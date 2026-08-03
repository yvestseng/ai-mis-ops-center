-- Keep the production role matrix and password lifecycle aligned with worker/auth.ts.
-- Existing accounts remain usable; only newly created/reset accounts are forced to change password.
ALTER TABLE app_users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS app_users_status_username_idx
  ON app_users(status, username);
--> statement-breakpoint
UPDATE roles SET permissions =
  '["dashboard.read","tickets.create","tickets.read.own","tickets.read.all","tickets.update","tickets.assign","assets.read","assets.write","services.read","services.write","surveys.read","surveys.read.all","surveys.followup.manage","rbac.manage","audit.read"]'
WHERE id = 'role-admin';
--> statement-breakpoint
UPDATE roles SET permissions =
  '["dashboard.read","tickets.create","tickets.read.own","tickets.read.all","tickets.update","tickets.assign","assets.read","assets.write","services.read","services.write","surveys.read","surveys.read.all"]'
WHERE id = 'role-operator';
--> statement-breakpoint
UPDATE roles SET permissions =
  '["dashboard.read","tickets.create","tickets.read.own","assets.read","services.read","surveys.submit.own","surveys.read.own"]'
WHERE id = 'role-user';
