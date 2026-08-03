-- Demo credentials were exposed during validation. Disable them in shared and production D1 databases.
UPDATE app_users
SET status = 'disabled',
    updated_at = CURRENT_TIMESTAMP
WHERE id IN ('user-demo-admin', 'user-demo-operator', 'user-demo-user')
   OR lower(username) IN ('admin01', 'mis01', 'user01')
   OR lower(email) IN ('admin01@demo.local', 'mis01@demo.local', 'user01@demo.local');
--> statement-breakpoint
UPDATE auth_sessions
SET revoked_at = CURRENT_TIMESTAMP
WHERE user_id IN (
  SELECT id
  FROM app_users
  WHERE id IN ('user-demo-admin', 'user-demo-operator', 'user-demo-user')
     OR lower(username) IN ('admin01', 'mis01', 'user01')
     OR lower(email) IN ('admin01@demo.local', 'mis01@demo.local', 'user01@demo.local')
);
