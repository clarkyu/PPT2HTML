/**
 * 轻量固定窗口限流（内存实现，单进程有效）。生成类路由用它挡住匿名放大/成本型 DoS。
 * 多实例/边缘部署应换为 Redis 或上游网关限流（与 deck-store 同属 M5 前的过渡实现）。
 */
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const e = buckets.get(key);
  if (!e || now > e.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (e.count >= limit) return false;
  e.count += 1;
  return true;
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "anon";
}
