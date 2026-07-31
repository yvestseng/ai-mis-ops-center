-- 系統使用問卷：每個登入帳號永久限填一次，送出後不可修改。
DROP INDEX IF EXISTS survey_responses_type_device_date_uq;

DELETE FROM survey_responses
WHERE survey_type = 'system_usage'
  AND id NOT IN (
    SELECT MIN(id)
    FROM survey_responses
    WHERE survey_type = 'system_usage'
    GROUP BY respondent_hash
  );

CREATE UNIQUE INDEX IF NOT EXISTS survey_responses_system_user_uq
ON survey_responses (survey_type, respondent_hash)
WHERE survey_type = 'system_usage';
