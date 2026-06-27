/**
 * Mock Provider：无 LLM Key（离线/CI/开发）时确定性合成结构化结果，
 * 使「一句话 → 意图 → 大纲 → 全文」整条闭环可跑通、可测试。
 * 产出贴近真实教学法结构（导入—讲解—举例—互动—小结），并通过对应 Zod schema 校验。
 */
import type { GradeLevel, Slide } from "@/schema/types";
import type { OutlineParsed } from "@/schema/zod";
import {
  intentCardSchema,
  type DraftBlock,
  type DraftSection,
  type DraftSlide,
  type IntentCard,
  type IntentField,
} from "@/ai/schemas";
import type { LLMProvider, StructuredArgs } from "./types";

const SUBJECT_KEYWORDS: Array<[RegExp, string]> = [
  [/数学|代数|几何|函数|方程/, "数学"],
  [/语文|古诗|文言|阅读|作文/, "语文"],
  [/英语|english|单词|语法/i, "英语"],
  [/物理|力学|电学|光学/, "物理"],
  [/化学|分子|元素|反应/, "化学"],
  [/生物|细胞|光合|遗传|生态/, "生物"],
  [/历史|朝代|战争|文明/, "历史"],
  [/地理|气候|地形|板块/, "地理"],
  [/政治|道德|法治/, "政治"],
  [/信息|编程|计算机|算法|代码/, "信息技术"],
  [/科学/, "科学"],
];

const GRADE_KEYWORDS: Array<[RegExp, GradeLevel]> = [
  [/学前|幼儿/, "preschool"],
  [/小学|小[一二三四五六]|[一二三四五六]年级/, "primary"],
  [/初中|初[一二三]|七年级|八年级|九年级/, "junior"],
  [/高中|高[一二三]/, "senior"],
  [/职教|中职|职业/, "vocational"],
  [/大学|高校|本科/, "higher"],
  [/成人|培训/, "adult"],
];

export const GRADE_LABEL: Record<GradeLevel, string> = {
  preschool: "学前",
  primary: "小学",
  junior: "初中",
  senior: "高中",
  vocational: "职教",
  higher: "高校",
  adult: "成人",
};

function detect<T>(text: string, table: Array<[RegExp, T]>): T | undefined {
  for (const [re, val] of table) if (re.test(text)) return val;
  return undefined;
}

function extractTopic(sentence: string): string {
  let s = sentence.trim();
  // 去掉常见祈使/填充词与时长片段，留下主题
  s = s
    .replace(/^(给|为|帮|向)[^，。,.]*?(讲讲|讲一下|讲解|介绍|来讲|说说)/g, "")
    .replace(/(帮我|给我|请|麻烦)?(做|生成|写|准备|来)(一节|一个|一份|个|节)?/g, "")
    .replace(/(讲讲|讲一下|讲解一下|介绍一下|说说)/g, "")
    .replace(/(关于|的)?课件?/g, "")
    .replace(/\d+\s*分钟|一课时|课时/g, "")
    .replace(/(面向|针对)?(小学生|初中生|高中生|大学生|小学|初中|高中|高校|大学|成人)/g, "")
    .replace(/[，。,.！!？?]/g, " ")
    .trim();
  return s.length >= 2 ? s : sentence.trim();
}

export function synthIntent(sentence: string): IntentCard {
  const filled: IntentField[] = [];

  const subject = detect(sentence, SUBJECT_KEYWORDS) ?? (filled.push("subject"), "综合");
  // 默认学段以大学为主（可在意图卡片中一键改）
  const gradeLevel = detect(sentence, GRADE_KEYWORDS) ?? (filled.push("gradeLevel"), "higher");

  const durMatch = sentence.match(/(\d+)\s*分钟/);
  const durationMinutes = durMatch ? parseInt(durMatch[1], 10) : (filled.push("durationMinutes"), 40);

  const style =
    detect(sentence, [
      [/活泼|有趣|趣味/, "活泼趣味"],
      [/严谨|学术/, "严谨学术"],
      [/简洁|极简/, "简洁"],
    ]) ?? (filled.push("style"), "通用");

  const topic = extractTopic(sentence);

  return intentCardSchema.parse({ topic, subject, gradeLevel, durationMinutes, style, filled });
}

export function synthOutline(intent: IntentCard): OutlineParsed {
  const t = intent.topic;
  return {
    title: t,
    sections: [
      { title: `导入：走进「${t}」`, pedagogyRole: "intro", points: ["从生活情境引入", "提出核心问题", "明确本节学习目标"] },
      { title: `讲解一：${t} 的核心概念`, pedagogyRole: "explain", points: ["概念的定义与内涵", "关键要素拆解", "常见理解误区"] },
      { title: `讲解二：${t} 的原理与过程`, pedagogyRole: "explain", points: ["原理逐步拆解", "关键步骤与过程", "图示与直观说明"] },
      { title: `举例：${t} 的典型应用`, pedagogyRole: "example", points: ["典型例题/案例", "解题与分析思路", "变式与拓展"] },
      { title: "课堂互动：检测与讨论", pedagogyRole: "interaction", points: ["快速投票热身", "限时小测验"] },
      { title: "小结：回顾与提升", pedagogyRole: "summary", points: ["核心要点回顾", "课后思考与延伸"] },
    ],
  };
}

function sentenceFor(point: string, topic: string): string {
  return `围绕「${topic}」，${point}：结合学情由浅入深展开，配合提问与示例帮助学生理解。`;
}

export function synthSection(
  intent: IntentCard,
  outline: OutlineParsed,
  index: number,
): DraftSection {
  const sec = outline.sections[index];
  const role = sec.pedagogyRole ?? "explain";
  const t = intent.topic;

  const slides: DraftSection["slides"] = [];

  // 首节前置一页封面
  if (index === 0) {
    slides.push({
      layout: "title",
      pedagogyRole: "cover",
      speakerNotes: "开场，简要说明本节课要解决的问题。",
      blocks: [
        { type: "heading", level: 1, text: t },
        {
          type: "text",
          text: `${intent.subject} · ${GRADE_LABEL[intent.gradeLevel]} · ${intent.durationMinutes} 分钟`,
          emphasis: true,
        },
      ],
    });
  }

  const baseBlocks: DraftSection["slides"][number]["blocks"] = [
    { type: "heading", level: 2, text: sec.title },
    { type: "bulletList", items: sec.points },
  ];

  if (role === "intro") {
    baseBlocks.push({
      type: "poll",
      prompt: `关于「${t}」，你最想先弄清楚哪一点？`,
      options: ["它是什么", "它怎么来的", "它有什么用", "它和我有什么关系"],
      runtime: { live: false },
    });
  } else if (role === "interaction") {
    baseBlocks.push({
      type: "quiz",
      prompt: `课堂小测：关于「${t}」`,
      timeLimitSec: 120,
      questions: [
        {
          type: "mcq",
          prompt: `下列关于「${t}」的说法，哪一项最准确？`,
          options: [`${t} 的核心要点（正确项）`, "以偏概全的说法", "张冠李戴的说法", "无关干扰项"],
          answerIndex: 0,
          explanation: "回到本节讲解的核心定义即可判断。",
        },
        {
          type: "mcq",
          prompt: `「${t}」最关键的作用是？`,
          options: ["核心作用（正确项）", "次要作用", "无关作用", "尚未涉及"],
          answerIndex: 0,
        },
      ],
      runtime: { live: false },
    });
  } else if (role === "summary") {
    baseBlocks.push({
      type: "mcq",
      prompt: `本节关于「${t}」，最关键的一点是？`,
      options: ["核心概念与原理", "次要细节", "无关信息", "尚未涉及的内容"],
      answerIndex: 0,
      explanation: "紧扣本节学习目标。",
      runtime: { live: false },
    });
    baseBlocks.push({ type: "text", text: `课后思考：尝试用自己的话向同学解释「${t}」。` });
  } else {
    baseBlocks.push({ type: "text", text: sentenceFor(sec.points[0] ?? "核心内容", t) });
  }

  slides.push({
    layout: role === "summary" ? "centered" : "single",
    pedagogyRole: role,
    speakerNotes: `本页对应「${sec.title}」，建议用时约 ${Math.max(2, Math.round(intent.durationMinutes / outline.sections.length))} 分钟。`,
    blocks: baseBlocks,
  });

  return { title: sec.title, slides };
}

/** 离线精修：按指令关键词对单页做局部改写（保持「局部修改、不洗牌全篇」）。 */
export function synthRefine(slide: Slide, instruction: string): DraftSlide {
  const headingBlock = slide.blocks.find((b) => b.type === "heading");
  const title = headingBlock && headingBlock.type === "heading" ? headingBlock.text : "本页";
  const heading = { type: "heading" as const, level: 2 as const, text: title };
  const ins = instruction;

  if (/案例|例子|举例|case|example/i.test(ins)) {
    return {
      layout: "single",
      pedagogyRole: "example",
      speakerNotes: "结合案例讲解，引导学生分析。",
      blocks: [
        { type: "heading", level: 2, text: `案例：${title}` },
        { type: "text", text: `下面用一个贴近学情的案例来说明「${title}」。` },
        { type: "bulletList", items: ["背景与问题", "分析过程（关键步骤）", "结论与启示"] },
      ],
    };
  }
  if (/简化|精简|删减|短一点|更短/.test(ins)) {
    const bullets = slide.blocks.find((b) => b.type === "bulletList");
    const items = bullets && bullets.type === "bulletList" ? bullets.items.slice(0, 2) : ["要点一", "要点二"];
    return { layout: "centered", pedagogyRole: slide.pedagogyRole, blocks: [heading, { type: "bulletList", items }] };
  }
  if (/测验|出题|练习|检测|小测|加.*题/.test(ins)) {
    return {
      layout: "single",
      pedagogyRole: "interaction",
      blocks: [
        heading,
        {
          type: "mcq",
          prompt: `关于「${title}」，下列哪一项正确？`,
          options: ["正确项", "干扰项一", "干扰项二", "干扰项三"],
          answerIndex: 0,
          explanation: "回到本页核心要点即可判断。",
          runtime: { live: false },
        },
      ],
    };
  }
  if (/投票|讨论|互动/.test(ins)) {
    return {
      layout: "single",
      pedagogyRole: "interaction",
      blocks: [
        heading,
        {
          type: "poll",
          prompt: `关于「${title}」，你的看法是？`,
          options: ["看法 A", "看法 B", "看法 C", "不确定"],
          runtime: { live: false },
        },
      ],
    };
  }
  if (/详细|展开|深入|丰富|补充/.test(ins)) {
    return {
      layout: "single",
      pedagogyRole: slide.pedagogyRole,
      blocks: [
        heading,
        { type: "text", text: `围绕「${title}」展开更详细的讲解：` },
        { type: "bulletList", items: ["概念的精确定义", "适用条件与边界", "与相关概念的区别", "常见误区与纠正"] },
      ],
    };
  }
  // 默认：未识别具体指令时不破坏原页——保留原内容（去 id，由 assembler 重新注入），仅追加一条说明。
  return {
    layout: slide.layout,
    pedagogyRole: slide.pedagogyRole,
    speakerNotes: slide.speakerNotes?.slice(0, 2000),
    blocks: [
      ...slide.blocks.map((b) => {
        const rest = { ...b } as Record<string, unknown>;
        delete rest.id;
        return rest as unknown as DraftBlock;
      }),
      { type: "text", text: `已按指令调整：${ins}` },
    ],
  };
}

export const mockProvider: LLMProvider = {
  name: "mock",
  async generateStructured<T>(args: StructuredArgs<T>): Promise<T> {
    const { mock, schema } = args;
    let result: unknown;
    switch (mock.key) {
      case "intent":
        result = synthIntent((mock.input as { sentence: string }).sentence);
        break;
      case "outline":
        result = synthOutline((mock.input as { intent: IntentCard }).intent);
        break;
      case "section": {
        const inp = mock.input as { intent: IntentCard; outline: OutlineParsed; index: number };
        result = synthSection(inp.intent, inp.outline, inp.index);
        break;
      }
      case "validate":
        result = { issues: [{ severity: "info", message: "由 Mock 生成，建议人工复核学科准确性与教材版本。" }] };
        break;
      case "refine": {
        const inp = mock.input as { slide: Slide; instruction: string };
        result = synthRefine(inp.slide, inp.instruction);
        break;
      }
    }
    return schema.parse(result);
  },
};
