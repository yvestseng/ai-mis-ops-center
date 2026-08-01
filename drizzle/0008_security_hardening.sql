CREATE TABLE IF NOT EXISTS login_attempts (
  id text PRIMARY KEY NOT NULL,
  login_key text NOT NULL,
  ip_hash text NOT NULL,
  succeeded integer DEFAULT 0 NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS login_attempts_lookup_idx
  ON login_attempts(login_key, ip_hash, created_at);
CREATE INDEX IF NOT EXISTS auth_sessions_active_idx
  ON auth_sessions(token_hash, expires_at, revoked_at);
