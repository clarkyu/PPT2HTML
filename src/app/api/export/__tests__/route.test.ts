/**
 * 导出路由的快速守卫测试（内存模式，不启动浏览器）。
 * 404 与限流均在启动 Playwright 之前短路，故无需真实浏览器。
 * 用唯一 x-real-ip 隔离各用例的限流桶（clientIp 在未信任 XFF 时取 x-real-ip）。
 */
import { describe, expect, it } from "vitest";
import { GET } from "../[id]/route";

function call(id: string, ip: string) {
  const req = new Request(`http://localhost/api/export/${id}`, { headers: { "x-real-ip": ip } });
  return GET(req, { params: Promise.resolve({ id }) });
}

describe("GET /api/export/[id]", () => {
  it("不存在的课件返回 404（不启动浏览器）", async () => {
    const res = await call("deck_does_not_exist_export", "test-404");
    expect(res.status).toBe(404);
  });

  it("超过每分钟限流返回 429（在渲染前短路）", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      statuses.push((await call("deck_missing_rl", "test-ratelimit")).status);
    }
    // 限额 6/min：前 6 次放行（课件不存在 → 404），第 7、8 次被限流 429。
    expect(statuses.slice(0, 6).every((s) => s === 404)).toBe(true);
    expect(statuses[6]).toBe(429);
    expect(statuses[7]).toBe(429);
  });
});
