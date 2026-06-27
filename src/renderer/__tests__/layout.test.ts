import { describe, it, expect } from "vitest";
import type { Block, Slide, SlideLayout } from "@/schema/types";
import { getArrangement, getStackWidthClass, isMediaBlock } from "../layout";

const heading = (id: string, level: 1 | 2 | 3 = 2): Block => ({ id, type: "heading", level, text: "t" });
const text = (id: string): Block => ({ id, type: "text", text: "t" });
const image = (id: string): Block => ({ id, type: "image", src: "/x.png" });

function slide(layout: SlideLayout, blocks: Block[]): Slide {
  return { id: "s", layout, blocks };
}

describe("布局引擎 getArrangement", () => {
  it("two-column 把前导标题抽为通栏 header，正文平分两栏", () => {
    const a = getArrangement(slide("two-column", [heading("h"), text("a"), text("b"), text("c")]));
    expect(a.kind).toBe("split");
    if (a.kind !== "split") return;
    expect(a.header.map((b) => b.id)).toEqual(["h"]);
    // body = [a,b,c], mid=ceil(3/2)=2 → primary=[a,b], secondary=[c]
    expect(a.primary.map((b) => b.id)).toEqual(["a", "b"]);
    expect(a.secondary.map((b) => b.id)).toEqual(["c"]);
  });

  it("two-column 标题不再被孤立到单栏（heading+正文 两块降级为堆叠）", () => {
    const a = getArrangement(slide("two-column", [heading("h"), text("a")]));
    // 抽走 header 后 body=[a]，secondary 为空 → 降级 stack，避免空白半屏
    expect(a.kind).toBe("stack");
  });

  it("two-column 单块降级为堆叠（避免空栏）", () => {
    const a = getArrangement(slide("two-column", [text("only")]));
    expect(a.kind).toBe("stack");
  });

  it("media-left 无媒体块时降级为堆叠", () => {
    const a = getArrangement(slide("media-left", [heading("h"), text("a")]));
    expect(a.kind).toBe("stack");
  });

  it("media-right 媒体置于 secondary（右侧），其余置于 primary", () => {
    const a = getArrangement(slide("media-right", [text("a"), image("img")]));
    expect(a.kind).toBe("split");
    if (a.kind !== "split") return;
    expect(a.mediaSide).toBe("right");
    expect(a.primary.map((b) => b.id)).toEqual(["a"]);
    expect(a.secondary.map((b) => b.id)).toEqual(["img"]);
  });

  it("single / title / centered / media-full → 堆叠", () => {
    for (const l of ["single", "title", "centered", "media-full"] as SlideLayout[]) {
      expect(getArrangement(slide(l, [text("a")])).kind).toBe("stack");
    }
  });
});

describe("辅助", () => {
  it("isMediaBlock 识别 image / media", () => {
    expect(isMediaBlock(image("i"))).toBe(true);
    expect(isMediaBlock(text("t"))).toBe(false);
  });

  it("media-full 全幅（无 max-w 约束），其余收敛宽度", () => {
    expect(getStackWidthClass("media-full")).toBe("w-full");
    expect(getStackWidthClass("single")).toContain("max-w-4xl");
  });
});
