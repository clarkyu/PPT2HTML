/**
 * 网页版课件生成契约测试：计划归一化的不变式 + 离线 Mock 全场景合成必过 schema。
 * 这是「生成永不整体失败」承诺的机器可验证部分。
 */
import { describe, expect, it } from "vitest";
import {
  coursePlanSchema,
  courseSlideSchema,
  normalizePlan,
  type CoursePlan,
} from "@/course/schema";
import { synthCoursePlan, synthCourseScene } from "@/course/mock";

function kinds(p: CoursePlan): string[] {
  return p.scenes.map((s) => s.kind);
}

describe("normalizePlan 不变式", () => {
  it("缺封面/小结/交互/小测时全部补齐，且首封面尾小结", () => {
    const p = normalizePlan({
      title: "光合作用",
      eyebrow: "生物 · 第1课",
      subtitle: "一堂课看懂能量从哪来",
      scenes: [
        { kind: "cards", goal: "拆解三要素" },
        { kind: "statement", goal: "钩子" },
        { kind: "cards", goal: "过程" },
      ],
    });
    const k = kinds(p);
    expect(k[0]).toBe("cover");
    expect(k[k.length - 1]).toBe("summary");
    expect(k).toContain("playground");
    expect(k).toContain("quiz");
    expect(coursePlanSchema.safeParse(p).success).toBe(true);
  });

  it("中段的多余封面/小结被剔除", () => {
    const p = normalizePlan({
      title: "T",
      eyebrow: "E",
      subtitle: "S",
      scenes: [
        { kind: "cover", goal: "开场" },
        { kind: "summary", goal: "中途乱入的小结" },
        { kind: "cover", goal: "乱入的第二封面" },
        { kind: "cards", goal: "讲解" },
        { kind: "playground", goal: "aha" },
        { kind: "quiz", goal: "测" },
        { kind: "summary", goal: "收束" },
      ],
    });
    const k = kinds(p);
    expect(k.filter((x) => x === "cover")).toHaveLength(1);
    expect(k.filter((x) => x === "summary")).toHaveLength(1);
    expect(k[0]).toBe("cover");
    expect(k[k.length - 1]).toBe("summary");
    // 模型写的小结 goal 被保留
    expect(p.scenes[p.scenes.length - 1].goal).toBe("中途乱入的小结");
  });

  it("超长计划被裁到 ≤10 页且骨架完整；归一化幂等", () => {
    const p = normalizePlan({
      title: "T",
      eyebrow: "E",
      subtitle: "S",
      scenes: Array.from({ length: 10 }, (_, i) => ({
        kind: i % 2 ? ("statement" as const) : ("cards" as const),
        goal: `第${i}页`,
      })),
    });
    expect(p.scenes.length).toBeLessThanOrEqual(10);
    const k = kinds(p);
    expect(k[0]).toBe("cover");
    expect(k[k.length - 1]).toBe("summary");
    expect(k).toContain("playground");
    expect(k).toContain("quiz");
    expect(normalizePlan(p)).toEqual(p);
  });
});

describe("离线 Mock 合成", () => {
  const SENTENCES = [
    "给初中生讲 AI 编程，从 Claude 开始",
    "给高中生讲傅里叶变换，直观一点，40 分钟",
    "复利",
  ];

  it("任意一句话 → 计划合法且满足叙事骨架", () => {
    for (const s of SENTENCES) {
      const plan = synthCoursePlan(s);
      expect(coursePlanSchema.safeParse(plan).success).toBe(true);
      const k = kinds(plan);
      expect(k[0]).toBe("cover");
      expect(k[k.length - 1]).toBe("summary");
      expect(k).toContain("playground");
      expect(k).toContain("quiz");
    }
  });

  it("计划内每个场景的合成页都过 schema（兜底通道永不产废）", () => {
    for (const s of SENTENCES) {
      const plan = synthCoursePlan(s);
      plan.scenes.forEach((_, i) => {
        const slide = synthCourseScene(s, plan, i);
        const parsed = courseSlideSchema.safeParse(slide);
        expect(parsed.success, `sentence=${s} scene#${i}`).toBe(true);
        expect(slide.kind).toBe(plan.scenes[i].kind);
      });
    }
  });

  it("合成确定性：同输入同输出", () => {
    const a = synthCoursePlan(SENTENCES[0]);
    const b = synthCoursePlan(SENTENCES[0]);
    expect(a).toEqual(b);
    expect(synthCourseScene(SENTENCES[0], a, 3)).toEqual(synthCourseScene(SENTENCES[0], b, 3));
  });
});
