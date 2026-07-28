-- 0004_ticket_rating_permissions.sql
-- AI MIS Ops Center
-- Add ticket rating permissions to roles.permissions JSON
-- Cloudflare D1 / SQLite

-- General user: submit ratings for own resolved/closed tickets and read own ratings.
UPDATE roles
SET permissions = json_insert(
    permissions,
    '$[#]',
    'surveys.submit.own',
    '$[#]',
    'surveys.read.own'
),
updated_at = CURRENT_TIMESTAMP
WHERE code = 'user'
  AND json_valid(permissions)
  AND NOT EXISTS (
      SELECT 1
      FROM json_each(roles.permissions)
      WHERE value = 'surveys.submit.own'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM json_each(roles.permissions)
      WHERE value = 'surveys.read.own'
  );

-- MIS operator: submit/read own ratings and read all survey results.
UPDATE roles
SET permissions = json_insert(
    permissions,
    '$[#]',
    'surveys.submit.own',
    '$[#]',
    'surveys.read.own',
    '$[#]',
    'surveys.read.all'
),
updated_at = CURRENT_TIMESTAMP
WHERE code = 'operator'
  AND json_valid(permissions)
  AND NOT EXISTS (
      SELECT 1
      FROM json_each(roles.permissions)
      WHERE value = 'surveys.submit.own'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM json_each(roles.permissions)
      WHERE value = 'surveys.read.own'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM json_each(roles.permissions)
      WHERE value = 'surveys.read.all'
  );

-- Administrator: all survey permissions.
UPDATE roles
SET permissions = json_insert(
    permissions,
    '$[#]',
    'surveys.submit.own',
    '$[#]',
    'surveys.read.own',
    '$[#]',
    'surveys.read.all',
    '$[#]',
    'surveys.followup.manage'
),
updated_at = CURRENT_TIMESTAMP
WHERE code = 'admin'
  AND json_valid(permissions)
  AND NOT EXISTS (
      SELECT 1
      FROM json_each(roles.permissions)
      WHERE value = 'surveys.submit.own'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM json_each(roles.permissions)
      WHERE value = 'surveys.read.own'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM json_each(roles.permissions)
      WHERE value = 'surveys.read.all'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM json_each(roles.permissions)
      WHERE value = 'surveys.followup.manage'
  );
