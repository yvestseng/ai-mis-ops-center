-- Password hashing metadata and transparent work-factor upgrade support.
-- Existing rows are explicitly treated as the legacy 10,000-iteration PBKDF2-SHA256 format.
ALTER TABLE app_users ADD COLUMN password_algorithm TEXT NOT NULL DEFAULT 'PBKDF2-SHA256';
--> statement-breakpoint
ALTER TABLE app_users ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 10000;
--> statement-breakpoint
UPDATE app_users
SET password_algorithm = 'PBKDF2-SHA256',
    password_iterations = 10000
WHERE password_hash IS NOT NULL;
