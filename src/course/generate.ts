/**
 * 网页版课件生成 pipeline：一句话 → 叙事弧计划 → 逐场景写作。
 * 每步走 Provider 抽象层（有 Key 真实模型，无 Key 离线 Mock），产出经 Zod 校验 + 确定性归一。
 * forceMock：单页真实生成失败时的兜底通道——永远给出合法内容，生成流程不许整体失败。
 */
import type { ZodType } from "zod";
import { getProvider, mockProvider } from "@/ai/provider";
import {
  COURSE_PLAN_SYSTEM,
  COURSE_SCENE_SYSTEM,
  coursePlanUser,
  courseSceneUser,
} from "./prompts";
import {
  coursePlanSchema,
  normalizePlan,
  SLIDE_SCHEMA_BY_KIND,
  type CoursePlan,
  type CourseSlide,
} from "./schema";

export async function runCoursePlan(sentence: string): Promise<CoursePlan> {
  const raw = await getProvider().generateStructured({
    system: COURSE_PLAN_SYSTEM,
    user: coursePlanUser(sentence),
    schema: coursePlanSchema,
    tier: "standard",
    mock: { key: "coursePlan", input: { sentence } },
  });
  // 无论模型产出什么，归一化保证叙事弧成立（首封面/尾小结/有 Aha/有小测）。
  return normalizePlan(raw);
}

export async function runCourseScene(args: {
  sentence: string;
  plan: CoursePlan;
  index: number;
  /** 真实生成失败后的兜底：强制走离线 Mock，保证该页必有合法内容。 */
  forceMock?: boolean;
}): Promise<CourseSlide> {
  const scene = args.plan.scenes[args.index];
  // 锁定形态：该页只接受计划中形态的 schema，模型跑偏会触发修复重试。
  const schema = SLIDE_SCHEMA_BY_KIND[scene.kind] as unknown as ZodType<CourseSlide>;
  const provider = args.forceMock ? mockProvider : getProvider();
  return provider.generateStructured({
    system: COURSE_SCENE_SYSTEM,
    user: courseSceneUser(args),
    schema,
    // 交互页要写真实可跑的代码，是最重的创作，走 heavy 档。
    tier: scene.kind === "playground" ? "heavy" : "standard",
    mock: { key: "courseScene", input: { sentence: args.sentence, plan: args.plan, index: args.index } },
  });
}
