/**
 * 资源（导入图片）存取。配置 DATABASE_URL 时存 PostgreSQL（持久化），否则内存回退。
 * id 同步生成（供映射阶段先填入 image.src），字节异步写入（putAsset）。
 *
 * 技术债（见 roadmap M5 / task F3）：图片字节以 BYTEA 整存仅为过渡，生产前应迁移至
 * S3 兼容对象存储（复用 .env.example 的 S3_* 变量），DB 仅留 key/content_type 元数据——
 * 否则 assets 体积会绑架 pg_dump/PITR 备份成本。
 */
import { randomBytes } from "node:crypto";
import { getPool, usePostgres, type Executor } from "./db";

export interface Asset {
  contentType: string;
  data: Uint8Array;
}

// 内存回退：FIFO + 字节预算，避免无界增长（仅无 DB 模式）。
const MAX_ASSETS = 20000;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
const mem = new Map<string, Asset>();
let memBytes = 0;

function evictOldest(): boolean {
  const oldest = mem.keys().next().value;
  if (oldest === undefined) return false;
  const a = mem.get(oldest);
  if (a) memBytes -= a.data.byteLength;
  mem.delete(oldest);
  return true;
}

export function newAssetId(): string {
  // CSPRNG：资源 URL 即访问凭证，需不可预测（base64url 字符集，校验正则需相应放宽）。
  return `a_${randomBytes(16).toString("base64url")}`;
}

export async function putAsset(
  id: string,
  data: Uint8Array,
  contentType: string,
  exec?: Executor,
): Promise<void> {
  if (usePostgres) {
    await (exec ?? getPool()).query(
      `INSERT INTO assets (id, content_type, data) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [id, contentType, Buffer.from(data)],
    );
    return;
  }
  while (
    (mem.size >= MAX_ASSETS || memBytes + data.byteLength > MAX_TOTAL_BYTES) &&
    evictOldest()
  ) {
    /* 腾出容量 */
  }
  mem.set(id, { contentType, data });
  memBytes += data.byteLength;
}

export async function getAsset(id: string): Promise<Asset | null> {
  if (usePostgres) {
    const { rows } = await getPool().query(
      `SELECT content_type, data FROM assets WHERE id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    return { contentType: rows[0].content_type, data: new Uint8Array(rows[0].data) };
  }
  return mem.get(id) ?? null;
}
