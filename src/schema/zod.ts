/**
 * 课件数据模型 · Zod 运行时校验
 *
 * 与 types.ts 同源。用途：
 *  1. LLM 产出 → 解析校验 → 不合规则重试/修复（见 docs/04-ai-pipeline.md）
 *  2. 持久化前再校验，保证库中数据始终合法
 *  3. 经 zod-to-json-schema 转换后作为 LLM 结构化生成的约束
 *
 * 通过 z.infer 反推的类型应与 types.ts 保持一致（CI 可加同构断言测试）。
 */
import { z } from "zod";

// ===== 枚举 =====

export const gradeLevelSchema = z.enum([
  "preschool",
  "primary",
  "junior",
  "senior",
  "vocational",
  "higher",
  "adult",
]);

export const deckSourceSchema = z.enum(["prompt", "pptx-import"]);

export const pedagogyRoleSchema = z.enum([
  "cover",
  "intro",
  "explain",
  "example",
  "interaction",
  "summary",
]);

export const slideLayoutSchema = z.enum([
  "title",
  "single",
  "two-column",
  "media-left",
  "media-right",
  "media-full",
  "centered",
]);

export const slideTransitionSchema = z.enum(["none", "fade", "slide"]);

// ===== 内容块 =====

const blockBase = { id: z.string().min(1) };

export const headingBlockSchema = z.object({
  ...blockBase,
  type: z.literal("heading"),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string(),
});

export const textBlockSchema = z.object({
  ...blockBase,
  type: z.literal("text"),
  text: z.string(),
  emphasis: z.boolean().optional(),
});

export const bulletListBlockSchema = z.object({
  ...blockBase,
  type: z.literal("bulletList"),
  ordered: z.boolean().optional(),
  items: z.array(z.string()),
});

export const imageBlockSchema = z.object({
  ...blockBase,
  type: z.literal("image"),
  src: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export const codeBlockSchema = z.object({
  ...blockBase,
  type: z.literal("code"),
  language: z.string(),
  code: z.string(),
});

export const quoteBlockSchema = z.object({
  ...blockBase,
  type: z.literal("quote"),
  text: z.string(),
  cite: z.string().optional(),
});

export const tableBlockSchema = z.object({
  ...blockBase,
  type: z.literal("table"),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const mediaBlockSchema = z.object({
  ...blockBase,
  type: z.literal("media"),
  kind: z.enum(["video", "audio"]),
  src: z.string(),
});

export const formulaBlockSchema = z.object({
  ...blockBase,
  type: z.literal("formula"),
  latex: z.string(),
});

export const contentBlockSchema = z.discriminatedUnion("type", [
  headingBlockSchema,
  textBlockSchema,
  bulletListBlockSchema,
  imageBlockSchema,
  codeBlockSchema,
  quoteBlockSchema,
  tableBlockSchema,
  mediaBlockSchema,
  formulaBlockSchema,
]);

// ===== 互动块 =====

const interactiveRuntimeSchema = z.object({
  live: z.boolean(),
  sessionId: z.string().optional(),
});

const interactiveBase = {
  ...blockBase,
  prompt: z.string(),
  runtime: interactiveRuntimeSchema.optional(),
};

export const pollBlockSchema = z.object({
  ...interactiveBase,
  type: z.literal("poll"),
  options: z.array(z.string()),
  multi: z.boolean().optional(),
});

export const mcqBlockSchema = z.object({
  ...interactiveBase,
  type: z.literal("mcq"),
  options: z.array(z.string()),
  answerIndex: z.number().int().nonnegative(),
  explanation: z.string().optional(),
});

export const trueFalseBlockSchema = z.object({
  ...interactiveBase,
  type: z.literal("trueFalse"),
  answer: z.boolean(),
  explanation: z.string().optional(),
});

export const quizBlockSchema = z.object({
  ...interactiveBase,
  type: z.literal("quiz"),
  questions: z.array(mcqBlockSchema),
  timeLimitSec: z.number().int().positive().optional(),
});

export const discussionWallBlockSchema = z.object({
  ...interactiveBase,
  type: z.literal("discussionWall"),
  mode: z.enum(["danmu", "list"]),
});

export const wordCloudBlockSchema = z.object({
  ...interactiveBase,
  type: z.literal("wordCloud"),
});

export const interactiveBlockSchema = z.discriminatedUnion("type", [
  pollBlockSchema,
  mcqBlockSchema,
  trueFalseBlockSchema,
  quizBlockSchema,
  discussionWallBlockSchema,
  wordCloudBlockSchema,
]);

// 全部块（内容 + 互动）
export const blockSchema = z.union([contentBlockSchema, interactiveBlockSchema]);

// ===== 节 / 页 / 顶层 =====

export const slideSchema = z.object({
  id: z.string().min(1),
  layout: slideLayoutSchema,
  blocks: z.array(blockSchema),
  speakerNotes: z.string().optional(),
  transition: slideTransitionSchema.optional(),
  pedagogyRole: pedagogyRoleSchema.optional(),
});

export const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  summary: z.string().optional(),
  slides: z.array(slideSchema),
});

export const deckMetaSchema = z.object({
  title: z.string(),
  subject: z.string().optional(),
  gradeLevel: gradeLevelSchema.optional(),
  durationMinutes: z.number().int().positive().optional(),
  language: z.string().default("zh-CN"),
  objectives: z.array(z.string()).optional(),
  source: deckSourceSchema,
});

export const deckSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().nonnegative(),
  meta: deckMetaSchema,
  templateId: z.string(),
  theme: z
    .object({
      colors: z
        .object({
          primary: z.string(),
          secondary: z.string(),
          accent: z.string(),
          background: z.string(),
          surface: z.string(),
          text: z.string(),
          muted: z.string(),
        })
        .partial()
        .optional(),
      fontFamily: z
        .object({ heading: z.string().optional(), body: z.string().optional() })
        .optional(),
      fontScale: z.number().positive().optional(),
      logoUrl: z.string().optional(),
    })
    .optional(),
  sections: z.array(sectionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// 大纲（生成流水线 M2 用，轻量结构）
export const outlineSchema = z.object({
  title: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      points: z.array(z.string()),
      pedagogyRole: pedagogyRoleSchema.optional(),
    }),
  ),
});

export type DeckParsed = z.infer<typeof deckSchema>;
export type OutlineParsed = z.infer<typeof outlineSchema>;
