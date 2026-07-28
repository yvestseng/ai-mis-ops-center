-- 0005_fix_survey_role_permissions.sql
-- Cloudflare D1 / SQLite
-- Only general users may submit and view their own service rating.

UPDATE roles
SET permissions = (
  SELECT json_group_array(permission)
  FROM (
    SELECT DISTINCT CAST(value AS TEXT) AS permission
    FROM json_each(
      CASE WHEN json_valid(roles.permissions)
           THEN roles.permissions ELSE '[]' END
    )
    WHERE CAST(value AS TEXT) NOT IN (
      'surveys.read',
      'surveys.read.all',
      'surveys.followup.manage',
      'surveys.submit.own',
      'surveys.read.own'
    )
    UNION ALL SELECT 'surveys.submit.own'
    UNION ALL SELECT 'surveys.read.own'
  )
),
updated_at = CURRENT_TIMESTAMP
WHERE code = 'user';

UPDATE roles
SET permissions = (
  SELECT json_group_array(permission)
  FROM (
    SELECT DISTINCT CAST(value AS TEXT) AS permission
    FROM json_each(
      CASE WHEN json_valid(roles.permissions)
           THEN roles.permissions ELSE '[]' END
    )
    WHERE CAST(value AS TEXT) NOT IN (
      'surveys.submit.own',
      'surveys.read.own'
    )
  )
),
updated_at = CURRENT_TIMESTAMP
WHERE code IN ('operator', 'admin');

SELECT code, name, permissions, json_valid(permissions) AS json_valid
FROM roles
WHERE code IN ('admin', 'operator', 'user')
ORDER BY code;
