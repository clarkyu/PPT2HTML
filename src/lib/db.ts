/**
 * PostgreSQL 连接池（node-postgres）。仅在配置了 DATABASE_URL 时使用；
 * 未配置时各 store 回退到内存实现（便于本地/CI/无 DB 环境运行）。
 */
import { Pool } from "pg";

/** 是否启用 Postgres 持久化（由 DATABASE_URL 决定）。 */
export const usePostgres = Boolean(process.env.DATABASE_URL);

const g = globalThis as unknown as { __pgPool?: Pool };

export function getPool(): Pool {
  if (!g.__pgPool) {
    g.__pgPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  }
  return g.__pgPool;
}
