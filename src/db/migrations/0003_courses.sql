-- 言课 · 网页版课件（CourseDoc，「一句话 → 惊艳课件」流水线产物）。
-- 与 decks（PPT 式旧模型）分表：文档形态不同（场景分镜 vs 章节/块），互不污染读路径校验。
-- 幂等：可重复执行。

CREATE TABLE IF NOT EXISTS courses (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  data       JSONB NOT NULL,
  owner_id   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS courses_owner_id_idx ON courses (owner_id, created_at DESC);
