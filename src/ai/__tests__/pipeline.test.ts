import { beforeEach, describe, expect, it } from "vitest";
import {
  assembleDeck,
  materializeBlocks,
  pickTemplate,
  runIntent,
  runOutline,
  runRefine,
  runSection,
} from "@/ai/pipeline";
import { draftSlideSchema, intentCardSchema } from "@/ai/schemas";
import { deckSchema } from "@/schema/zod";
import type { Block, Slide } from "@/schema/types";

// 强制 Mock 模式（无 Key），保证测试确定性、与 CI 一致
beforeEach(() => {
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.LLM_DEFAULT_PROVIDER = "deepseek";
});

describe("生成流水线（Mock 模式）", () => {
  it("意图解析：抽取时长、未明确学段默认大学并标注补全", async () => {
    const intent = await runIntent("给大一新生讲讲什么是机器学习，45 分钟");
    expect(intentCardSchema.safeParse(intent).success).toBe(true);
    expect(intent.durationMinutes).toBe(45);
    expect(intent.gradeLevel).toBe("higher");
    expect(intent.filled).toContain("gradeLevel"); // 学段是系统补的
    expect(intent.filled).not.toContain("durationMinutes"); // 时长是用户给的
  });

  it("一句话 → 意图 → 大纲 → 逐节全文 → 合法 Deck", async () => {
    const intent = await runIntent("高校《数据结构》二叉树遍历");
    const outline = await runOutline(intent);
    expect(outline.sections.length).toBeGreaterThanOrEqual(5);

    const drafts = [];
    for (let i = 0; i < outline.sections.length; i++) {
      drafts.push(await runSection(intent, outline, i));
    }

    const deck = assembleDeck(intent, drafts, {
      id: "deck_test",
      now: "2026-06-27T00:00:00.000Z",
      templateId: pickTemplate(intent),
    });

    expect(deckSchema.safeParse(deck).success).toBe(true);
    // 首页为封面
    expect(deck.sections[0].slides[0].pedagogyRole).toBe("cover");
    // 每个块都有 id
    const allBlocks = deck.sections.flatMap((s) => s.slides.flatMap((sl) => sl.blocks));
    expect(allBlocks.every((b) => typeof b.id === "string" && b.id.length > 0)).toBe(true);

    // quiz 内嵌题也被注入了系统 id（递归 id 注入）
    const quizzes = allBlocks.filter((b): b is Extract<Block, { type: "quiz" }> => b.type === "quiz");
    expect(quizzes.length).toBeGreaterThan(0);
    for (const q of quizzes) {
      expect(q.questions.every((qq) => typeof qq.id === "string" && qq.id.length > 0)).toBe(true);
    }
    // 互动块统一带 runtime（mock/real 路径一致）
    const interactives = allBlocks.filter((b) =>
      ["poll", "mcq", "trueFalse", "quiz"].includes(b.type),
    );
    expect(interactives.every((b) => "runtime" in b && b.runtime?.live === false)).toBe(true);
  });

  it("精修：指令「换成案例」产出合法草稿页；materializeBlocks 注入稳定 id", async () => {
    const slide: Slide = {
      id: "s1",
      layout: "single",
      blocks: [
        { id: "h", type: "heading", level: 2, text: "二叉树遍历" },
        { id: "t", type: "text", text: "前序/中序/后序。" },
      ],
    };
    const draft = await runRefine({
      subject: "信息技术",
      gradeLevel: "higher",
      slide,
      instruction: "把这一页换成案例",
    });
    expect(draftSlideSchema.safeParse(draft).success).toBe(true);
    expect(draft.pedagogyRole).toBe("example");
    const blocks = materializeBlocks(draft.blocks);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every((b) => typeof b.id === "string" && b.id.length > 0)).toBe(true);
  });

  it("pickTemplate：低龄→暖珊瑚，人文→学术绿，其余→经典蓝", async () => {
    expect(pickTemplate({ ...base(), gradeLevel: "primary" })).toBe("tpl-warm-coral");
    expect(pickTemplate({ ...base(), subject: "历史" })).toBe("tpl-academic-green");
    expect(pickTemplate({ ...base(), subject: "数学" })).toBe("tpl-classic-blue");
  });
});

function base() {
  return {
    topic: "x",
    subject: "数学",
    gradeLevel: "higher" as const,
    durationMinutes: 40,
    style: "通用",
    filled: [],
  };
}
