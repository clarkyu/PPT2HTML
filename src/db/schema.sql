-- 言课 · 数据库 schema（PostgreSQL）。幂等，可重复执行（db:init）。
-- 课件正文以 JSONB 整存（data），并冗余少量元数据列用于列表/排序/检索。

CREATE TABLE IF NOT EXISTS decks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  subject     TEXT,
  grade_level TEXT,
  template_id TEXT NOT NULL,
  source      TEXT NOT NULL,
  version     INTEGER NOT NULL,
  slide_count INTEGER NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS decks_updated_at_idx ON decks (updated_at DESC);

CREATE TABLE IF NOT EXISTS assets (
  id           TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data         BYTEA NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
