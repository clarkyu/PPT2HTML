-- 言课 · 初始 schema（PostgreSQL）。幂等，可重复执行。
-- 课件正文以 JSONB 整存（data），并冗余少量元数据列用于列表/排序/检索。
--
-- 冗余列与 data 的派生关系（约束：只允许经 deck-store.saveDeck 写入，与 data 同写）：
--   title=data->meta->>title, subject=data->meta->>subject, grade_level=data->meta->>gradeLevel,
--   source=data->meta->>source, template_id=data->>templateId, version=data->>version,
--   slide_count=sections 内 slides 总数。

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
