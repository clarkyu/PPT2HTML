/**
 * 资源存储（M4 导入图片用，内存实现）。导入的 PPT 图片暂存于此，经 /api/assets/[id] 提供，
 * 课件以 `/api/assets/{id}` 作为 image src（站内相对路径，满足媒体白名单）。
 *
 * 过渡实现（M5 前）：单进程有效、重启丢失、多实例不共享。
 * 警告：达到容量上限会按 FIFO 淘汰最旧资源——包括仍被已落库课件引用的图片，从而导致
 * 该图 /api/assets/{id} 返回 404、概览/播放页裂图。上限取得较宽以降低概率；
 * M5 接入对象存储后改为持久化、按引用生命周期管理。
 */
export interface Asset {
  contentType: string;
  data: Uint8Array;
}

const MAX_ASSETS = 20000;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

const store = new Map<string, Asset>();
let totalBytes = 0;

function evictOldest(): boolean {
  const oldest = store.keys().next().value;
  if (oldest === undefined) return false;
  const a = store.get(oldest);
  if (a) totalBytes -= a.data.byteLength;
  store.delete(oldest);
  return true;
}

export function saveAsset(data: Uint8Array, contentType: string): string {
  while (
    (store.size >= MAX_ASSETS || totalBytes + data.byteLength > MAX_TOTAL_BYTES) &&
    evictOldest()
  ) {
    /* 腾出容量/字节预算 */
  }
  const id = `a_${Math.random().toString(36).slice(2, 12)}`;
  store.set(id, { contentType, data });
  totalBytes += data.byteLength;
  return id;
}

export function getAsset(id: string): Asset | null {
  return store.get(id) ?? null;
}
