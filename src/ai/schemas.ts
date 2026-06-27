/**
 * 生成流水线的边界 schema（AI 层）。
 * - IntentCard：意图解析结果（要素 + 哪些是系统补全的）。
 * - Outline：复用 deck 模型的 outlineSchema。
 * - DraftSection：内容生成产出的「无 id 草稿」，由 assembler 注入稳定 id 后并入 Deck。
 *   （让模型免于生成/维护 id，id 由系统确定性分配，见 docs/03-data-model.md）
 */
import { z } from "zod";
import {
  bulletListBlockSchema,
  codeBlockSchema,
  discussionWallBlockSchema,
  formulaBlockSchema,
  gradeLevelSchema,
  headingBlockSchema,
  imageBlockSchema,
  mcqBlockSchema,
  mediaBlockSchema,
  pedagogyRoleSchema,
  pollBlockSchema,
  quizBlockSchema,
  quoteBlockSchema,
  slideLayoutSchema,
  tableBlockSchema,
  textBlockSchema,
  trueFalseBlockSchema,
  wordCloudBlockSchema,
} from "@/schema/zod";

// 意图要素键
export const intentFieldSchema = z.enum([
  "topic",
  "subject",
  "gradeLevel",
  "durationMinutes",
  "style",
]);
export type IntentField = z.infer<typeof intentFieldSchema>;

export const intentCardSchema = z.object({
  topic: z.string().min(1),
  subject: z.string().min(1),
  gradeLevel: gradeLevelSchema,
  durationMinutes: z.number().int().positive(),
  style: z.string().min(1),
  /** 这些要素是系统替用户补全的（非用户明确给出），供前端「我替你补的」标注与一键纠偏。 */
  filled: z.array(intentFieldSchema),
});
export type IntentCard = z.infer<typeof intentCardSchema>;

// 草稿块 = deck 块去掉 id（id 由 assembler 注入）
const dropId = { id: true } as const;
export const draftBlockSchema = z.discriminatedUnion("type", [
  headingBlockSchema.omit(dropId),
  textBlockSchema.omit(dropId),
  bulletListBlockSchema.omit(dropId),
  imageBlockSchema.omit(dropId),
  codeBlockSchema.omit(dropId),
  quoteBlockSchema.omit(dropId),
  tableBlockSchema.omit(dropId),
  mediaBlockSchema.omit(dropId),
  formulaBlockSchema.omit(dropId),
  pollBlockSchema.omit(dropId),
  mcqBlockSchema.omit(dropId),
  trueFalseBlockSchema.omit(dropId),
  quizBlockSchema.omit(dropId),
  discussionWallBlockSchema.omit(dropId),
  wordCloudBlockSchema.omit(dropId),
]);
export type DraftBlock = z.infer<typeof draftBlockSchema>;

export const draftSlideSchema = z.object({
  layout: slideLayoutSchema,
  pedagogyRole: pedagogyRoleSchema.optional(),
  speakerNotes: z.string().optional(),
  blocks: z.array(draftBlockSchema).min(1),
});
export type DraftSlide = z.infer<typeof draftSlideSchema>;

export const draftSectionSchema = z.object({
  title: z.string().min(1),
  slides: z.array(draftSlideSchema).min(1),
});
export type DraftSection = z.infer<typeof draftSectionSchema>;

// 校验结果
export const validationSchema = z.object({
  issues: z.array(
    z.object({
      severity: z.enum(["info", "warning"]),
      message: z.string(),
    }),
  ),
});
export type Validation = z.infer<typeof validationSchema>;
