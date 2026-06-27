/**
 * 布局引擎：把语义化的 `SlideLayout`（布局意图）落为各端的具体排布。
 *
 * 核心思想（docs/02-architecture.md）：页只存「内容块 + 布局意图」，不存坐标。
 * 手机一律单列纵向堆叠；md 及以上按布局意图分栏。这样多端自适应是确定性行为。
 */
import type { Block, HeadingBlock, Slide, SlideLayout } from "@/schema/types";

export function isMediaBlock(block: Block): boolean {
  return block.type === "image" || block.type === "media";
}

function isLeadHeading(block: Block): block is HeadingBlock {
  return block.type === "heading" && block.level <= 2;
}

export type SlideArrangement =
  | { kind: "stack"; blocks: Block[] }
  | {
      kind: "split";
      /** 通栏页眉（如页级标题），渲染在两栏之上，避免标题被切进半栏 */
      header: Block[];
      primary: Block[];
      secondary: Block[];
      mediaSide: "left" | "right";
    };

/** 根据布局意图，把块排布为「单列堆叠」或「两栏分割」。 */
export function getArrangement(slide: Slide): SlideArrangement {
  const { layout, blocks } = slide;

  if (layout === "two-column") {
    // 开头连续的页级标题（level<=2）抽为通栏页眉，避免标题被盲切到某一栏。
    let i = 0;
    while (i < blocks.length && isLeadHeading(blocks[i])) i++;
    const header = blocks.slice(0, i);
    const body = blocks.slice(i);
    const mid = Math.ceil(body.length / 2);
    const primary = body.slice(0, mid);
    const secondary = body.slice(mid);
    // 任一栏为空（如正文只有一块）则降级为单列堆叠，避免出现空白半屏。
    if (primary.length === 0 || secondary.length === 0) return { kind: "stack", blocks };
    return { kind: "split", header, primary, secondary, mediaSide: "left" };
  }

  if (layout === "media-left" || layout === "media-right") {
    const media = blocks.filter(isMediaBlock);
    const rest = blocks.filter((b) => !isMediaBlock(b));
    // 若该页实际没有媒体块，降级为单列堆叠，避免空栏。
    if (media.length === 0) return { kind: "stack", blocks };
    return {
      kind: "split",
      header: [],
      primary: layout === "media-left" ? media : rest,
      secondary: layout === "media-left" ? rest : media,
      mediaSide: layout === "media-left" ? "left" : "right",
    };
  }

  // title / single / media-full / centered → 单列堆叠（对齐方式由类名控制）
  return { kind: "stack", blocks };
}

/** 整页容器的对齐与间距（按布局意图）。 */
export function getSlideClasses(layout: SlideLayout): string {
  switch (layout) {
    case "title":
      return "items-center justify-center text-center";
    case "centered":
      return "items-center justify-center text-center";
    case "media-full":
      return "items-center justify-center";
    default:
      return "items-start justify-start";
  }
}

/** 单列堆叠时，内容列的宽度约束：media-full 全幅铺满，其余收敛到可读宽度。 */
export function getStackWidthClass(layout: SlideLayout): string {
  return layout === "media-full" ? "w-full" : "mx-auto w-full max-w-4xl";
}
