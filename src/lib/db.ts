/**
 * PostgreSQL 连接池（node-postgres）。仅在配置了 DATABASE_URL 时使用；
 * 未配置时各 store 回退到内存实现（便于本地/CI/无 DB 环境运行）。
 *
 * 部署边界（见 docs/08-open-questions.md「部署目标环境」）：
 * - 长驻进程（next start）下由 SIGTERM/SIGINT 钩子优雅 drain 连接；
 * - 纯 serverless 下依赖平台实例回收，钩子不触发亦无害。
 * - 多副本时需保证 max(=PG_POOL_MAX) × 副本数 ≤ PG max_connections，副本较多时前置 PgBouncer。
 */
import { Pool, type PoolClient } from "pg";

/** 是否启用 Postgres 持久化（由 DATABASE_URL 决定，模块加载期求值）。 */
export const usePostgres = Boolean(process.env.DATABASE_URL);

// next build 的页面数据收集阶段 NODE_ENV 为 production 但无需 DB，单独识别以免误伤构建。
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

// 生产运行时缺少 DATABASE_URL 时硬失败，避免以内存回退模式静默上线导致数据不持久。
if (!usePostgres && process.env.NODE_ENV === "production" && !isBuildPhase) {
  throw new Error("[db] 生产环境缺少 DATABASE_URL：拒绝以内存回退模式启动，避免数据不持久化。");
}
if (!isBuildPhase) {
  console.info(
    usePostgres
      ? "[db] 持久化模式：PostgreSQL（DATABASE_URL 已配置）"
      : "[db] 回退模式：内存存储（未配置 DATABASE_URL，数据不持久化）",
  );
}

/** 可执行 SQL 的对象：Pool 或事务中的 PoolClient 均满足，便于事务复用同一连接。 */
export type Executor = Pick<Pool, "query">;

const g = globalThis as unknown as { __pgPool?: Pool; __pgShutdownHooked?: boolean };

/**
 * 解析 SSL 配置。托管 Postgres（Supabase/Neon/RDS 等）默认要求 TLS。
 * 优先级：连接串已带 sslmode → 交给 pg 处理；否则看 PGSSL 环境变量；默认不强制（本地 docker PG）。
 */
function buildSslOption(): false | { rejectUnauthorized: boolean } | undefined {
  const url = process.env.DATABASE_URL ?? "";
  if (/[?&]sslmode=/.test(url)) return undefined; // 连接串已声明，避免双重配置
  switch (process.env.PGSSL) {
    case "false":
      return false;
    case "no-verify":
      return { rejectUnauthorized: false }; // 仅自签证书等场景显式启用（关闭证书校验，注意 MITM 风险）
    case "require":
      return { rejectUnauthorized: true };
    default:
      return undefined; // 默认不强制，保持本地行为不变
  }
}

export function getPool(): Pool {
  if (!g.__pgPool) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX ?? 10),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 10000),
      // 默认 0=池满时永久等待；设置后快速失败而非挂起整个请求。
      connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS ?? 5000),
      ssl: buildSslOption(),
    });
    // 必须监听：pg 的空闲客户端在后端断连（DB 重启/网络抖动/托管库回收）时会异步 emit 'error'，
    // 无监听器则 EventEmitter 直接 throw，造成未捕获异常使整个 Node 进程崩溃。
    pool.on("error", (err) => {
      console.error("[pg pool] idle client error", err);
    });
    // 长驻进程优雅关闭；用标志位避免 dev 热重载重复注册监听器。
    if (!g.__pgShutdownHooked) {
      g.__pgShutdownHooked = true;
      const close = async () => {
        try {
          await g.__pgPool?.end();
        } finally {
          process.exit(0);
        }
      };
      process.once("SIGTERM", close);
      process.once("SIGINT", close);
    }
    g.__pgPool = pool;
  }
  return g.__pgPool;
}

/** 在单事务内执行：整体提交或回滚。用于需原子性的多写（如导入：资源 + 课件）。 */
export async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
