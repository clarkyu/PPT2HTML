import { describe, expect, it } from "vitest";
import PptxGenJS from "pptxgenjs";
import { parsePptx } from "../pptx";
import { mapPptxToDeck } from "../map";
import { deckSchema } from "@/schema/zod";

// 1x1 透明 PNG
const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function buildPptx(): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  const s1 = pptx.addSlide();
  s1.addText("机器学习导论MLTITLE", { x: 1, y: 0.5, w: 8, h: 1, fontSize: 32 });
  const s2 = pptx.addSlide();
  s2.addText("什么是机器学习MLBODY", { x: 1, y: 0.5, w: 8, h: 1 });
  // breakLine 使每项成为独立段落（<a:p>），对应真实 PPT 的多段项目符号
  s2.addText(
    [
      { text: "监督学习PT1", options: { breakLine: true } },
      { text: "无监督学习PT2", options: { breakLine: true } },
    ],
    { x: 1, y: 2, w: 8, h: 2, bullet: true },
  );
  s2.addImage({ data: PNG_1x1, x: 6, y: 1, w: 1, h: 1 });
  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return new Uint8Array(out);
}

describe("PPT 导入（OOXML 解析 + 映射）", () => {
  it("解析提取文本与图片，映射为合法 Deck", async () => {
    const buf = await buildPptx();
    const parsed = await parsePptx(buf);

    expect(parsed.slides.length).toBe(2);
    const allText = parsed.slides.flatMap((s) => [s.title ?? "", ...s.bodies.flat()]).join("|");
    expect(allText).toContain("机器学习导论MLTITLE");
    expect(allText).toContain("什么是机器学习MLBODY");
    expect(allText).toContain("监督学习PT1");

    const imgCount = parsed.slides.reduce((n, s) => n + s.images.length, 0);
    expect(imgCount).toBeGreaterThanOrEqual(1);

    const { deck, assets } = mapPptxToDeck(parsed, {
      id: "deck_imp",
      now: "2026-06-27T00:00:00.000Z",
      templateId: "tpl-classic-blue",
      fallbackTitle: "测试",
    });
    expect(deckSchema.safeParse(deck).success).toBe(true);
    expect(deck.meta.source).toBe("pptx-import");
    expect(assets.length).toBeGreaterThanOrEqual(1);

    const blocks = deck.sections.flatMap((s) => s.slides).flatMap((sl) => sl.blocks);
    expect(blocks.some((b) => b.type === "bulletList")).toBe(true);
    expect(blocks.some((b) => b.type === "image" && b.src.startsWith("/api/assets/"))).toBe(true);
  });

  it("无效文件抛出可读错误", async () => {
    await expect(parsePptx(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
  });
});
