/**
 * 网页版课件（CourseDoc）数据模型 —— 「一句话 → 惊艳课件」流水线的契约层。
 *
 * 设计原则（Phase 1）：模型当导演/编剧，系统当美术/摄影/剪辑。
 * 模型只产出受限的「分镜脚本」（场景形态 + 投影级文案 + 交互参数），
 * 视觉/动效/转场全部由 CoursePlayer 与主题预先精修保证下限。
 * 各字段的长度上限即「投影级文案」约束：一页一主角、字少意大，细节进讲稿。
 */
import { z } from "zod";

// ===== 场景形态（页型白名单）=====

/** 封面：渐变大标题开场。 */
export const coverSlideSchema = z.object({
  kind: z.literal("cover"),
  eyebrow: z.string().min(1).max(30),
  title: z.string().min(1).max(20),
  subtitle: z.string().min(1).max(60),
});

/** 大字宣言：一句话钩子/转场（认知钩子、金句、承上启下）。 */
export const statementSlideSchema = z.object({
  kind: z.literal("statement"),
  eyebrow: z.string().min(1).max(30),
  title: z.string().min(1).max(40),
  sub: z.string().max(90).optional(),
});

/** 卡片网格：并列概念/分类/方式（2–4 张）。 */
export const cardsSlideSchema = z.object({
  kind: z.literal("cards"),
  eyebrow: z.string().min(1).max(30),
  title: z.string().min(1).max(36),
  lead: z.string().max(70).optional(),
  cards: z
    .array(
      z.object({
        label: z.string().min(1).max(8),
        title: z.string().min(1).max(16),
        desc: z.string().min(1).max(60),
      }),
    )
    .min(2)
    .max(4),
});

/** AI Playground 脚本（脚本化演示：打字→思考→流式代码→讲解）。 */
export const playgroundScriptSchema = z.object({
  label: z.string().min(1).max(16),
  prompt: z.string().min(4).max(160),
  filename: z.string().min(1).max(40),
  language: z.string().min(1).max(12),
  code: z.string().min(10).max(1600),
  explanation: z.string().max(160).optional(),
});
export type PlaygroundScriptDoc = z.infer<typeof playgroundScriptSchema>;

/** 交互页：内嵌可玩的「提示词 → Claude 流式写代码」演示（Aha 时刻）。 */
export const playgroundSlideSchema = z.object({
  kind: z.literal("playground"),
  eyebrow: z.string().min(1).max(30),
  title: z.string().min(1).max(36),
  lead: z.string().max(70).optional(),
  scripts: z.array(playgroundScriptSchema).min(1).max(2),
});

/** 随堂小测：单选 + 即时反馈讲解。 */
const quizSlideBase = z.object({
  kind: z.literal("quiz"),
  eyebrow: z.string().min(1).max(30),
  title: z.string().min(1).max(70),
  options: z.array(z.string().min(1).max(40)).min(2).max(4),
  answer: z.number().int().nonnegative(),
  explain: z.string().min(1).max(160),
});
// 独立使用（逐场景生成锁形态）时带越界校验；联合内的校验见 courseSlideSchema.superRefine。
export const quizSlideSchema = quizSlideBase.refine((q) => q.answer < q.options.length, {
  message: "answer 越界",
});

/** 小结：要点回顾 + 下一课预告。 */
export const summarySlideSchema = z.object({
  kind: z.literal("summary"),
  eyebrow: z.string().min(1).max(30),
  title: z.string().min(1).max(36),
  bullets: z.array(z.string().min(1).max(40)).min(2).max(4),
  next: z.string().min(1).max(40),
});

export const courseSlideSchema = z
  .discriminatedUnion("kind", [
    coverSlideSchema,
    statementSlideSchema,
    cardsSlideSchema,
    playgroundSlideSchema,
    quizSlideBase, // 带 refine 的成员不被 discriminatedUnion 接受，越界校验在下方补
    summarySlideSchema,
  ])
  .superRefine((s, ctx) => {
    if (s.kind === "quiz" && s.answer >= s.options.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quiz answer 越界" });
    }
  });
export type CourseSlide = z.infer<typeof courseSlideSchema>;
export type SlideKind = CourseSlide["kind"];

/** 按形态取单页 schema（逐场景生成时锁定该页必须是计划中的形态）。 */
export const SLIDE_SCHEMA_BY_KIND = {
  cover: coverSlideSchema,
  statement: statementSlideSchema,
  cards: cardsSlideSchema,
  playground: playgroundSlideSchema,
  quiz: quizSlideSchema,
  summary: summarySlideSchema,
} as const;

// ===== 课件文档 =====

export const courseDocSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(40),
  /** 生成来源的一句话（回溯/再生成用；分享页不展示）。 */
  sentence: z.string().max(500).optional(),
  theme: z.literal("dark"),
  slides: z.array(courseSlideSchema).min(3).max(12),
  createdAt: z.string().datetime(),
});
export type CourseDoc = z.infer<typeof courseDocSchema>;

// ===== 叙事弧计划（阶段②③的产物）=====

export const slideKindSchema = z.enum([
  "cover",
  "statement",
  "cards",
  "playground",
  "quiz",
  "summary",
]);

export const coursePlanSchema = z.object({
  /** 课件标题（封面大字），投影级短。 */
  title: z.string().min(1).max(20),
  eyebrow: z.string().min(1).max(30),
  subtitle: z.string().min(1).max(60),
  scenes: z
    .array(
      z.object({
        kind: slideKindSchema,
        /** 这一页要完成的叙事任务（给写作阶段的导演指令）。 */
        goal: z.string().min(2).max(90),
      }),
    )
    .min(3)
    .max(10),
});
export type CoursePlan = z.infer<typeof coursePlanSchema>;
export type PlannedScene = CoursePlan["scenes"][number];

/**
 * 计划归一化（确定性修复）：无论模型产出什么，保证叙事弧成立——
 * 首页封面、末页小结、至少一个 Aha 交互页、至少一个小测；总页数 ≤ 10。
 * 修复优于报错：生成永远不许因计划不完美而失败。
 */
export function normalizePlan(plan: CoursePlan): CoursePlan {
  // 中段剔除多余的封面/小结（它们只允许在首/尾）。
  let scenes = plan.scenes.filter((s, i) => {
    if (s.kind === "cover") return i === 0;
    if (s.kind === "summary") return false; // 统一在尾部重建
    return true;
  });

  if (scenes[0]?.kind !== "cover") {
    scenes.unshift({ kind: "cover", goal: `开场点题：${plan.title}` });
  }

  const has = (k: SlideKind) => scenes.some((s) => s.kind === k);
  if (!has("playground")) {
    // Aha 放在中后段（概念之后、检测之前）。
    const at = Math.min(scenes.length, Math.max(2, scenes.length - 1));
    scenes.splice(at, 0, { kind: "playground", goal: "让学生亲眼看 AI 当场完成一个相关小任务" });
  }
  if (!has("quiz")) {
    scenes.push({ kind: "quiz", goal: "用一道单选检验本课核心概念" });
  }

  // 尾部小结（保留模型的 goal 若有）。
  const plannedSummary = plan.scenes.find((s) => s.kind === "summary");
  scenes.push(plannedSummary ?? { kind: "summary", goal: "回顾要点并预告下一课" });

  // 超长裁剪：从后往前丢弃非必备形态（statement 先于 cards），保住叙事骨架。
  const MAX = 10;
  const lastIndexOfKind = (k: SlideKind) => {
    for (let i = scenes.length - 1; i >= 0; i--) if (scenes[i].kind === k) return i;
    return -1;
  };
  for (const drop of ["statement", "cards"] as const) {
    while (scenes.length > MAX) {
      const idx = lastIndexOfKind(drop);
      if (idx <= 0) break;
      scenes.splice(idx, 1);
    }
  }
  // 仍超长的兜底：保住封面与小结，从小结前逐个移除（实际计划规模下几乎不会触发）。
  while (scenes.length > MAX) scenes.splice(scenes.length - 2, 1);

  return { ...plan, scenes };
}
