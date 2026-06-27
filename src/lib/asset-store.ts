/**
 * 资源（导入图片）存取。配置 DATABASE_URL 时存 PostgreSQL（持久化），否则内存回退。
 * id 同步生成（供映射阶段先填入 image.src），字节异步写入（putAsset）。
 */
import { getPool, usePostgres } from "./db";

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
  return `a_${Math.random().toString(36).slice(2, 12)}`;
}

export async function putAsset(id: string, data: Uint8Array, contentType: string): Promise<void> {
  if (usePostgres) {
    await getPool().query(
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
