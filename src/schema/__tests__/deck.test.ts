import { describe, it, expect } from "vitest";
import { deckSchema } from "../zod";
import { sampleDeck } from "../fixtures/sample-deck";
import { createBlockId } from "../factory";

describe("课件数据模型", () => {
  it("示例 Deck 通过 Zod 校验", () => {
    const result = deckSchema.safeParse(sampleDeck);
    expect(result.success).toBe(true);
  });

  it("拒绝缺失必填字段的 Deck", () => {
    const broken = { ...sampleDeck, meta: { ...sampleDeck.meta, title: undefined } };
    const result = deckSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("拒绝未知的块类型（保证持久化数据合法）", () => {
    const broken = structuredClone(sampleDeck);
    // @ts-expect-error 故意注入非法块类型
    broken.sections[0].slides[0].blocks.push({ id: "x", type: "unknown" });
    const result = deckSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("createBlockId 生成唯一 id", () => {
    const a = createBlockId();
    const b = createBlockId();
    expect(a).not.toBe(b);
  });

  it("theme.fontScale 越界被拒，合理值通过", () => {
    const ok = structuredClone(sampleDeck);
    ok.theme = { fontScale: 1.4 };
    expect(deckSchema.safeParse(ok).success).toBe(true);
    const bad = structuredClone(sampleDeck);
    bad.theme = { fontScale: 50 };
    expect(deckSchema.safeParse(bad).success).toBe(false);
  });

  it("拒绝越界的 mcq answerIndex（跨字段超精校验）", () => {
    const bad = structuredClone(sampleDeck);
    bad.sections[0].slides[0].blocks.push({
      id: "x",
      type: "mcq",
      prompt: "q",
      options: ["a", "b"],
      answerIndex: 5,
      runtime: { live: false },
    });
    expect(deckSchema.safeParse(bad).success).toBe(false);
  });

  it("theme.logoUrl 走媒体白名单：拒绝 javascript:，放行 https", () => {
    const ok = structuredClone(sampleDeck);
    ok.theme = { logoUrl: "https://example.com/logo.png" };
    expect(deckSchema.safeParse(ok).success).toBe(true);
    const bad = structuredClone(sampleDeck);
    bad.theme = { logoUrl: "javascript:alert(1)" };
    expect(deckSchema.safeParse(bad).success).toBe(false);
  });
});
