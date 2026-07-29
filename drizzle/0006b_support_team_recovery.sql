PRAGMA foreign_keys = ON;

-- =========================================================
-- 維運團隊資料表
-- =========================================================
CREATE TABLE IF NOT EXISTS support_teams (
    id TEXT PRIMARY KEY NOT NULL,
    team_code TEXT NOT NULL UNIQUE,
    team_name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_support_teams_active_order
ON support_teams (is_active, display_order);

-- =========================================================
-- tickets 尚缺少的指派欄位
-- =========================================================
ALTER TABLE tickets ADD COLUMN assigned_team_id TEXT;
ALTER TABLE tickets ADD COLUMN assigned_user_id TEXT;
ALTER TABLE tickets ADD COLUMN ai_suggested_team_id TEXT;
ALTER TABLE tickets ADD COLUMN assignment_source TEXT;
ALTER TABLE tickets ADD COLUMN assigned_at TEXT;

CREATE INDEX IF NOT EXISTS idx_app_users_team_assignable
ON app_users (team_id, is_assignable, status);

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_team_id
ON tickets (assigned_team_id);

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_user_id
ON tickets (assigned_user_id);

CREATE INDEX IF NOT EXISTS idx_tickets_assignment_status
ON tickets (assigned_team_id, assigned_user_id, status);

-- =========================================================
-- 預設維運團隊
-- =========================================================
INSERT OR IGNORE INTO support_teams
(
    id,
    team_code,
    team_name,
    description,
    display_order,
    is_active,
    created_at,
    created_by,
    updated_at,
    updated_by
)
VALUES
(
    'team-service-desk',
    'SERVICE_DESK',
    'MIS 服務台',
    '負責第一線受理、初步分析與派工。',
    10,
    1,
    CURRENT_TIMESTAMP,
    'system',
    CURRENT_TIMESTAMP,
    'system'
),
(
    'team-network',
    'NETWORK',
    '網路維運組',
    '負責 LAN、WAN、Wi-Fi、VPN、DNS、DHCP 與防火牆連線問題。',
    20,
    1,
    CURRENT_TIMESTAMP,
    'system',
    CURRENT_TIMESTAMP,
    'system'
),
(
    'team-system',
    'SYSTEM',
    '系統維運組',
    '負責 Windows、伺服器、Microsoft 365、端點與系統環境。',
    30,
    1,
    CURRENT_TIMESTAMP,
    'system',
    CURRENT_TIMESTAMP,
    'system'
),
(
    'team-security',
    'SECURITY',
    '資安管理組',
    '負責資安事件、Wazuh、EDR、弱點與異常登入。',
    40,
    1,
    CURRENT_TIMESTAMP,
    'system',
    CURRENT_TIMESTAMP,
    'system'
),
(
    'team-application',
    'APPLICATION',
    'ERP／應用系統組',
    '負責 ERP、內部應用程式及企業系統問題。',
    50,
    1,
    CURRENT_TIMESTAMP,
    'system',
    CURRENT_TIMESTAMP,
    'system'
),
(
    'team-database',
    'DATABASE',
    '資料庫管理組',
    '負責 Oracle、MySQL、SQL Server 與資料庫連線及效能問題。',
    60,
    1,
    CURRENT_TIMESTAMP,
    'system',
    CURRENT_TIMESTAMP,
    'system'
),
(
    'team-endpoint',
    'ENDPOINT',
    '電腦與設備維護組',
    '負責個人電腦、印表機、周邊設備及軟體安裝。',
    70,
    1,
    CURRENT_TIMESTAMP,
    'system',
    CURRENT_TIMESTAMP,
    'system'
);

-- =========================================================
-- 將既有文字派工轉成正式團隊 ID
-- =========================================================
UPDATE tickets
SET assigned_team_id =
    CASE assigned_team
        WHEN 'MIS 服務台' THEN 'team-service-desk'
        WHEN '網路維運組' THEN 'team-network'
        WHEN '網路組' THEN 'team-network'
        WHEN '系統維運組' THEN 'team-system'
        WHEN '資安管理組' THEN 'team-security'
        WHEN 'ERP／應用系統組' THEN 'team-application'
        WHEN '資料庫管理組' THEN 'team-database'
        WHEN '電腦與設備維護組' THEN 'team-endpoint'
        ELSE 'team-service-desk'
    END
WHERE assigned_team_id IS NULL;

UPDATE tickets
SET assignment_source = 'migration'
WHERE assignment_source IS NULL;
