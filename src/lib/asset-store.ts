/**
 * 资源存储（M4 导入图片用，内存实现）。导入的 PPT 图片暂存于此，经 /api/assets/[id] 提供，
 * 课件以 `/api/assets/{id}` 作为 image src（站内相对路径，满足媒体白名单）。
 * 与 deck-store 同属 M5 前过渡：单进程有效、重启丢失；M5 接入对象存储后替换实现。
 */
export interface Asset {
  contentType: string;
  data: Uint8Array;
}

const MAX_ASSETS = 1000;
const store = new Map<string, Asset>();

export function saveAsset(data: Uint8Array, contentType: string): string {
  // 简单 FIFO 淘汰，避免内存无界增长。
  if (store.size >= MAX_ASSETS) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  const id = `a_${Math.random().toString(36).slice(2, 12)}`;
  store.set(id, { contentType, data });
  return id;
}

export function getAsset(id: string): Asset | null {
  return store.get(id) ?? null;
}
