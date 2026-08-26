-- AI MIS OPS Center v0.6.1 - TOTP MFA Security Hardening
-- Additive forward migration. Existing authentication and RBAC data is preserved.

ALTER TABLE auth_sessions ADD COLUMN mfa_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE auth_sessions ADD COLUMN mfa_verified_at TEXT;
ALTER TABLE auth_sessions ADD COLUMN mfa_method TEXT;

CREATE TABLE user_mfa_settings (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'totp',
  secret_ciphertext TEXT NOT NULL,
  secret_iv TEXT NOT NULL,
  secret_version INTEGER NOT NULL DEFAULT 1,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  last_totp_step INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX user_mfa_settings_user_uq
  ON user_mfa_settings(user_id);
CREATE INDEX user_mfa_settings_enabled_idx
  ON user_mfa_settings(is_enabled);

CREATE TABLE user_mfa_recovery_codes (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  mfa_setting_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  FOREIGN KEY (mfa_setting_id) REFERENCES user_mfa_settings(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX user_mfa_recovery_codes_hash_uq
  ON user_mfa_recovery_codes(code_hash);
CREATE INDEX user_mfa_recovery_codes_user_used_idx
  ON user_mfa_recovery_codes(user_id, used_at);

CREATE TABLE auth_mfa_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  portal TEXT NOT NULL,
  purpose TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX auth_mfa_challenges_token_uq
  ON auth_mfa_challenges(token_hash);
CREATE INDEX auth_mfa_challenges_user_expires_idx
  ON auth_mfa_challenges(user_id, expires_at);

-- Security posture after migration:
-- Existing sessions remain valid only for ordinary users. Admin/MIS sessions have
-- mfa_verified=0 and are therefore rejected by the server-side MFA gate until the
-- user completes a fresh password + MFA authentication flow.
