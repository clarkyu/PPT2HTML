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
});
