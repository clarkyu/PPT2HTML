// 应用数据库 schema（幂等）。用法：DATABASE_URL=... npm run db:init
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("缺少 DATABASE_URL");
  process.exit(1);
}

const sqlPath = fileURLToPath(new URL("../src/db/schema.sql", import.meta.url));
const sql = readFileSync(sqlPath, "utf8");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  console.log("数据库 schema 已应用");
} finally {
  await pool.end();
}
