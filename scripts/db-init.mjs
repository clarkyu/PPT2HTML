// 应用数据库迁移（版本化、按序、单事务、可重入）。用法：DATABASE_URL=... npm run db:init
//
// 每个 src/db/migrations/NNNN_*.sql 为一次结构变更（升序编号）。脚本：
//   1) 建 schema_migrations 版本表；2) 读已应用版本；3) 对未应用的逐个在事务内执行并记账。
// 已应用的跳过。新增改表时只需添加新编号文件，严禁修改已发布的迁移。
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("缺少 DATABASE_URL");
  process.exit(1);
}

const dir = fileURLToPath(new URL("../src/db/migrations/", import.meta.url));
const files = readdirSync(dir)
  .filter((f) => /^\d+.*\.sql$/.test(f))
  .sort();

async function withRetry(fn, { retries = 15, delayMs = 2000 } = {}) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      // Postgres 冷启动/未就绪属瞬态：ECONNREFUSED、57P03(starting up)。
      const transient =
        ["ECONNREFUSED", "ETIMEDOUT", "57P03"].includes(e.code) ||
        /starting up|timeout/i.test(e.message || "");
      if (!transient || i >= retries) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
pool.on("error", (err) => console.error("[pg pool] idle client error", err));

try {
  await withRetry(() => pool.query("SELECT 1")); // 等就绪（含 compose 启动竞态）
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    INTEGER PRIMARY KEY,
       name       TEXT NOT NULL,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );
  const { rows } = await pool.query("SELECT version FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.version));

  let count = 0;
  for (const file of files) {
    const version = Number(file.match(/^(\d+)/)[1]);
    if (applied.has(version)) {
      console.log(`跳过（已应用）：${file}`);
      continue;
    }
    const sql = readFileSync(new URL(file, `file://${dir}`), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version, name) VALUES ($1, $2)", [
        version,
        file,
      ]);
      await client.query("COMMIT");
      console.log(`已应用：${file}`);
      count++;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw new Error(`迁移 ${file} 执行失败：${e.message}`);
    } finally {
      client.release();
    }
  }
  console.log(count ? `迁移完成，新应用 ${count} 个。` : "数据库已是最新，无需迁移。");
} catch (e) {
  if (e.code === "ECONNREFUSED" || e.code === "ETIMEDOUT" || /timeout/i.test(e.message)) {
    console.error("无法连接 DATABASE_URL，请确认 Postgres 已就绪。", e.message);
  } else {
    console.error("迁移失败：", e.message);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
