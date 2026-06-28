/**
 * 导出路由的快速守卫测试（内存模式，不启动浏览器）。
 * 不存在的课件在启动 Playwright 之前即 404。
 */
import { describe, expect, it } from "vitest";
import { GET } from "../[id]/route";

function call(id: string, qs = "") {
  const req = new Request(`http://localhost/api/export/${id}${qs}`);
  return GET(req, { params: Promise.resolve({ id }) });
}

describe("GET /api/export/[id]", () => {
  it("不存在的课件返回 404（不启动浏览器）", async () => {
    const res = await call("deck_does_not_exist_export");
    expect(res.status).toBe(404);
  });
});
