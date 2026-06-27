import { describe, expect, it } from "vitest";
import { imageBlockSchema, mediaBlockSchema, outlineSchema, safeMediaSrc } from "@/schema/zod";
import { rateLimit } from "@/lib/rate-limit";

describe("安全与边界 guard", () => {
  it("safeMediaSrc 放行 https/相对/data:image，拦截 javascript: 等", () => {
    expect(safeMediaSrc.safeParse("https://x.com/a.png").success).toBe(true);
    expect(safeMediaSrc.safeParse("/local/a.png").success).toBe(true);
    expect(safeMediaSrc.safeParse("data:image/png;base64,AAA").success).toBe(true);
    expect(safeMediaSrc.safeParse("javascript:alert(1)").success).toBe(false);
    expect(safeMediaSrc.safeParse("http://x.com/a.png").success).toBe(false); // 非 https
  });

  it("image/media 块沿用 src 白名单", () => {
    expect(
      imageBlockSchema.safeParse({ id: "b", type: "image", src: "javascript:1" }).success,
    ).toBe(false);
    expect(
      mediaBlockSchema.safeParse({ id: "b", type: "media", kind: "video", src: "https://x/y.mp4" })
        .success,
    ).toBe(true);
  });

  it("outline 数组有上界，拒绝超量 sections", () => {
    const big = { title: "t", sections: Array.from({ length: 31 }, () => ({ title: "s", points: ["p"] })) };
    expect(outlineSchema.safeParse(big).success).toBe(false);
  });

  it("rateLimit 在窗口内超限即拒绝", () => {
    const key = "test-key-unique";
    let allowed = 0;
    for (let i = 0; i < 5; i++) if (rateLimit(key, 3, 60_000)) allowed++;
    expect(allowed).toBe(3);
  });
});
