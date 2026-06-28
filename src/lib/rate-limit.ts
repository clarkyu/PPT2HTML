/**
 * 轻量固定窗口限流（内存实现，单进程有效）。生成类路由用它挡住匿名放大/成本型 DoS。
 * 多实例/边缘部署应换为 Redis 或上游网关限流（与 deck-store 同属 M5 前的过渡实现）。
 */
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

// 上次清扫时间：长驻进程下定期回收过期桶，避免 Map 随独立 IP 数无界增长。
let lastSweep = 0;
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) {
    if (now > v.reset) buckets.delete(k);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const e = buckets.get(key);
  if (!e || now > e.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (e.count >= limit) return false;
  e.count += 1;
  return true;
}

/**
 * 取限流标识。X-Forwarded-For 可被客户端伪造，默认不信任；仅当上游反代强制重写并设
 * TRUST_PROXY_XFF=1 时才采用其首段。否则回退到平台注入的 x-real-ip，再到 "anon"。
 * 真正生产防护应在 M5 随网关/Redis 限流落地（见本文件顶部说明）。
 */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY_XFF === "1") {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
  }
  return req.headers.get("x-real-ip") ?? "anon";
}
