-- 言课 · 账户体系（M5-2）。用户、短信验证码（OTP）、课件归属。
-- 幂等：可重复执行。

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  phone      TEXT UNIQUE NOT NULL,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 每手机号至多一条有效验证码（按手机号 upsert，覆盖旧码）。
CREATE TABLE IF NOT EXISTS otp_codes (
  phone      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 课件归属：登录用户新建/认领的课件记录 owner_id；匿名创建为 NULL（按链接公开）。
ALTER TABLE decks ADD COLUMN IF NOT EXISTS owner_id TEXT;
CREATE INDEX IF NOT EXISTS decks_owner_id_idx ON decks (owner_id, updated_at DESC);
