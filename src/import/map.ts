/**
 * 把解析出的 PPT 内容映射进课件数据模型（与一句话生成产物同构的 Deck）。
 * 这是「迁移」：搬运内容与结构、套用模板，而非逐像素复刻。文本按 schema 上限裁剪，
 * 幻灯片分节装入（满足 section/slide 数量上界）。
 */
import type { Block, Deck, Section, Slide, SlideLayout } from "@/schema/types";
import { createBlockId } from "@/schema/factory";
import { saveAsset } from "@/lib/asset-store";
import type { ParsedPptx, ParsedSlide } from "./pptx";

const SLIDES_PER_SECTION = 40;

function slideToBlocks(ps: ParsedSlide, isCover: boolean): Block[] {
  const blocks: Block[] = [];
  if (ps.title) {
    blocks.push({
      id: createBlockId("b"),
      type: "heading",
      level: isCover ? 1 : 2,
      text: ps.title.slice(0, 500),
    });
  }
  for (const group of ps.bodies) {
    if (group.length > 1) {
      const items = group.map((s) => s.slice(0, 2000)).slice(0, 50);
      blocks.push({ id: createBlockId("b"), type: "bulletList", items });
    } else if (group.length === 1) {
      // 单段正文按 TextBlock 上限（5000）裁剪，避免不必要的截断
      blocks.push({ id: createBlockId("b"), type: "text", text: group[0].slice(0, 5000) });
    }
  }
  // 仅对能进入最终 blocks（≤50）的图片调用 saveAsset，避免写入永不被引用的资源
  const remaining = Math.max(0, 50 - blocks.length);
  for (const img of ps.images.slice(0, remaining)) {
    const aid = saveAsset(img.data, img.contentType);
    blocks.push({ id: createBlockId("b"), type: "image", src: `/api/assets/${aid}` });
  }
  if (blocks.length === 0) {
    blocks.push({ id: createBlockId("b"), type: "text", text: "（此页无可提取的文本/图片）" });
  }
  return blocks.slice(0, 50);
}

function slideLayout(ps: ParsedSlide, isCover: boolean): SlideLayout {
  if (isCover) return "title";
  const hasImg = ps.images.length > 0;
  const hasText = Boolean(ps.title) || ps.bodies.length > 0;
  if (hasImg && hasText) return "media-right";
  if (hasImg) return "media-full";
  return "single";
}

export function mapPptxToDeck(
  parsed: ParsedPptx,
  opts: { id: string; now: string; templateId: string; fallbackTitle: string },
): Deck {
  const slides: Slide[] = parsed.slides.map((ps, idx) => {
    const isCover = idx === 0;
    return {
      id: createBlockId("sld"),
      layout: slideLayout(ps, isCover),
      pedagogyRole: isCover ? "cover" : undefined,
      blocks: slideToBlocks(ps, isCover),
    };
  });

  // 分节装入（满足 section/slide 数量上界）
  const sections: Section[] = [];
  for (let start = 0; start < slides.length; start += SLIDES_PER_SECTION) {
    const chunk = slides.slice(start, start + SLIDES_PER_SECTION);
    sections.push({
      id: createBlockId("sec"),
      title:
        slides.length > SLIDES_PER_SECTION
          ? `幻灯片 ${start + 1}–${start + chunk.length}`
          : (parsed.title ?? opts.fallbackTitle).slice(0, 200),
      slides: chunk,
    });
  }

  return {
    id: opts.id,
    version: 1,
    meta: {
      title: (parsed.title ?? opts.fallbackTitle).slice(0, 200),
      language: "zh-CN",
      source: "pptx-import",
    },
    templateId: opts.templateId,
    sections,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}
