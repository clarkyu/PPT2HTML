/**
 * 生成流水线：意图解析 → 教学设计(大纲) → 内容生成(逐节) → 校验，以及把草稿组装为 Deck。
 * 每步走 Provider 抽象层（有 Key 真实模型，无 Key 离线 Mock），产出经 Zod 校验。
 */
import type { Block, Deck, GradeLevel, Section } from "@/schema/types";
import { createBlockId } from "@/schema/factory";
import { outlineSchema, type OutlineParsed } from "@/schema/zod";
import { getProvider } from "@/ai/provider";
import {
  draftSectionSchema,
  intentCardSchema,
  validationSchema,
  type DraftBlock,
  type DraftSection,
  type IntentCard,
  type Validation,
} from "@/ai/schemas";
import { INTENT_SYSTEM, OUTLINE_SYSTEM, SECTION_SYSTEM, VALIDATE_SYSTEM } from "@/ai/prompts";

export async function runIntent(sentence: string): Promise<IntentCard> {
  return getProvider().generateStructured({
    system: INTENT_SYSTEM,
    user: `老师的一句话：${sentence}`,
    schema: intentCardSchema,
    tier: "light",
    mock: { key: "intent", input: { sentence } },
  });
}

export async function runOutline(intent: IntentCard): Promise<OutlineParsed> {
  return getProvider().generateStructured({
    system: OUTLINE_SYSTEM,
    user: `意图：${JSON.stringify(intent)}`,
    schema: outlineSchema,
    tier: "light",
    mock: { key: "outline", input: { intent } },
  });
}

export async function runSection(
  intent: IntentCard,
  outline: OutlineParsed,
  index: number,
): Promise<DraftSection> {
  const sec = outline.sections[index];
  return getProvider().generateStructured({
    system: SECTION_SYSTEM,
    user: `意图：${JSON.stringify(intent)}\n大纲：${JSON.stringify(outline)}\n请只为第 ${index + 1} 节「${sec.title}」生成内容。`,
    schema: draftSectionSchema,
    tier: "heavy",
    mock: { key: "section", input: { intent, outline, index } },
  });
}

export async function runValidate(deck: Deck): Promise<Validation> {
  return getProvider().generateStructured({
    system: VALIDATE_SYSTEM,
    user: `课件 JSON（节选）：${JSON.stringify(deck).slice(0, 8000)}`,
    schema: validationSchema,
    tier: "standard",
    mock: { key: "validate", input: { deck } },
  });
}

/** 按学科/学段选默认模板（M3 可在 UI 中手动切换）。 */
export function pickTemplate(intent: IntentCard): string {
  const young: GradeLevel[] = ["preschool", "primary"];
  if (young.includes(intent.gradeLevel)) return "tpl-warm-coral";
  const humanities = ["语文", "历史", "地理", "政治", "英语"];
  if (humanities.includes(intent.subject)) return "tpl-academic-green";
  return "tpl-classic-blue";
}

const INTERACTIVE_TYPES = new Set([
  "poll",
  "mcq",
  "trueFalse",
  "quiz",
  "discussionWall",
  "wordCloud",
]);

/** 给草稿块注入稳定 id（含 quiz 内嵌题），并为互动块补默认 runtime（与 mock 路径一致）。 */
function materializeBlock(b: DraftBlock): Block {
  const block = { ...b, id: createBlockId("b") } as Block;
  if (b.type === "quiz") {
    (block as { questions: Array<{ id: string }> }).questions = b.questions.map((q) => ({
      ...q,
      id: createBlockId("b"),
    }));
  }
  if (INTERACTIVE_TYPES.has(b.type) && (block as { runtime?: unknown }).runtime === undefined) {
    (block as { runtime: { live: boolean } }).runtime = { live: false };
  }
  return block;
}

/** 把逐节草稿组装为完整 Deck，并注入稳定 id。 */
export function assembleDeck(
  intent: IntentCard,
  drafts: DraftSection[],
  opts: { id: string; now: string; templateId: string },
): Deck {
  const sections: Section[] = drafts.map((ds) => ({
    id: createBlockId("sec"),
    title: ds.title,
    slides: ds.slides.map((d) => ({
      id: createBlockId("sld"),
      layout: d.layout,
      pedagogyRole: d.pedagogyRole,
      speakerNotes: d.speakerNotes,
      blocks: d.blocks.map(materializeBlock),
    })),
  }));

  return {
    id: opts.id,
    version: 1,
    meta: {
      title: intent.topic,
      subject: intent.subject,
      gradeLevel: intent.gradeLevel,
      durationMinutes: intent.durationMinutes,
      language: "zh-CN",
      source: "prompt",
    },
    templateId: opts.templateId,
    sections,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}
