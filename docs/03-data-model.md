# 03 · 课件数据模型（核心架构赌注）

> 这是整个产品的枢纽。PRD 第八章：课件是「一份确定的结构化数据模型（以 JSON Schema
> 描述节、页、内容块、布局、媒体，以及互动元素）」。生成、导入、渲染、编辑、导出、互动
> 六件事全部围绕它。本文给出模型设计；落地代码见 `src/schema/`。

## 模型层级

```
Deck（课件）
 ├─ meta         课件元数据（学科/学段/主题/时长/语言）
 ├─ theme        主题覆盖（在模板之上的个性化：配色/字体/校徽）
 ├─ templateId   所选模板
 └─ sections[]   节
     └─ Section
         ├─ title
         └─ slides[]   页
             └─ Slide
                 ├─ layout        布局意图（非固定坐标）
                 ├─ speakerNotes  演讲者备注
                 └─ blocks[]      内容块（含互动块）
                     └─ Block（可辨识联合 discriminated union）
```

设计要点：**页不存固定坐标，只存内容块 + 布局意图**。固定坐标会把课件钉死在某一尺寸，违背「多端自适应」与「换模板而内容不变」。

## TypeScript 类型（权威定义在 `src/schema/`）

```ts
// ===== 顶层 =====
interface Deck {
  id: string;
  version: number;                 // 乐观锁/迁移用
  meta: DeckMeta;
  templateId: string;              // 见 templates 注册表
  theme?: ThemeOverride;           // 在模板之上的覆盖
  sections: Section[];
  createdAt: string;
  updatedAt: string;
}

interface DeckMeta {
  title: string;
  subject?: string;                // 学科
  gradeLevel?: GradeLevel;         // 学段
  durationMinutes?: number;        // 课时
  language: string;                // 默认 'zh-CN'
  objectives?: string[];          // 教学目标
  source: 'prompt' | 'pptx-import';// 生成来源
}

type GradeLevel =
  | 'preschool' | 'primary' | 'junior' | 'senior'
  | 'vocational' | 'higher' | 'adult';

// ===== 节 / 页 =====
interface Section {
  id: string;
  title: string;
  summary?: string;
  slides: Slide[];
}

interface Slide {
  id: string;
  layout: SlideLayout;             // 布局意图，渲染层按端落地
  blocks: Block[];
  speakerNotes?: string;           // 演讲者备注 (F9)
  transition?: 'none' | 'fade' | 'slide';
  pedagogyRole?: PedagogyRole;     // 该页在教学法中的角色
}

// 教学法结构：导入—讲解—举例—互动—小结 (F4)
type PedagogyRole =
  | 'intro' | 'explain' | 'example' | 'interaction' | 'summary' | 'cover';

// 布局意图（语义化，渲染层映射为各端栅格）
type SlideLayout =
  | 'title'            // 封面/标题
  | 'single'          // 单列内容
  | 'two-column'      // 两栏
  | 'media-left'      // 图文（图左）
  | 'media-right'     // 图文（图右）
  | 'media-full'      // 大图/全幅媒体
  | 'centered';       // 居中强调

// ===== 内容块（可辨识联合，按 type 区分） =====
type Block = ContentBlock | InteractiveBlock;

type ContentBlock =
  | HeadingBlock | TextBlock | BulletListBlock
  | ImageBlock  | CodeBlock  | QuoteBlock
  | TableBlock  | MediaBlock | FormulaBlock;

interface BlockBase { id: string; }

interface HeadingBlock  extends BlockBase { type: 'heading'; level: 1|2|3; text: string; }
interface TextBlock     extends BlockBase { type: 'text'; text: string; emphasis?: boolean; }
interface BulletListBlock extends BlockBase { type: 'bulletList'; ordered?: boolean; items: string[]; }
interface ImageBlock    extends BlockBase { type: 'image'; src: string; alt?: string; caption?: string; }
interface CodeBlock     extends BlockBase { type: 'code'; language: string; code: string; }
interface QuoteBlock    extends BlockBase { type: 'quote'; text: string; cite?: string; }
interface TableBlock    extends BlockBase { type: 'table'; headers: string[]; rows: string[][]; }
interface MediaBlock    extends BlockBase { type: 'media'; kind: 'video'|'audio'; src: string; }
interface FormulaBlock  extends BlockBase { type: 'formula'; latex: string; }  // 学科准确性

// ===== 互动块（一等公民；MVP 编排+静态呈现，Phase 2 实时运行） =====
type InteractiveBlock =
  | PollBlock | McqBlock | TrueFalseBlock | QuizBlock
  | DiscussionWallBlock | WordCloudBlock;

interface InteractiveBase extends BlockBase {
  prompt: string;                  // 题干/问题
  // 运行时能力在 Phase 2 注入；MVP 仅编排与呈现
  runtime?: { live: boolean; sessionId?: string };
}

interface PollBlock       extends InteractiveBase { type: 'poll'; options: string[]; multi?: boolean; }
interface McqBlock        extends InteractiveBase { type: 'mcq'; options: string[]; answerIndex: number; explanation?: string; }
interface TrueFalseBlock  extends InteractiveBase { type: 'trueFalse'; answer: boolean; explanation?: string; }
interface QuizBlock       extends InteractiveBase { type: 'quiz'; questions: McqBlock[]; timeLimitSec?: number; }
interface DiscussionWallBlock extends InteractiveBase { type: 'discussionWall'; mode: 'danmu'|'list'; }
interface WordCloudBlock  extends InteractiveBase { type: 'wordCloud'; }

// ===== 主题 / 模板 =====
interface ThemeOverride {
  colors?: Partial<ColorTokens>;   // 配色覆盖
  fontFamily?: { heading?: string; body?: string };
  fontScale?: number;              // 字号层级缩放
  logoUrl?: string;                // 校徽/个人标识
}

interface ColorTokens {
  primary: string; secondary: string; accent: string;
  background: string; surface: string; text: string; muted: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  colors: ColorTokens;             // 模板默认配色
  fontFamily: { heading: string; body: string };
  // 各 layout 在该模板下的栅格/留白规则由渲染层 + 模板 CSS 变量决定
}
```

## 设计原则与取舍

1. **块为最小可寻址单位**。每个块有稳定 `id`，精修（F8）按块级定位重写，不触发全篇洗牌；实时互动也以块为单元发起会话。

2. **布局是「意图」不是「坐标」**。`layout`/`pedagogyRole` 是语义标签，渲染层按设备把语义落为具体栅格。这让多端自适应是渲染层的确定性行为。

3. **内容与渲染彻底分离**。`Deck` 不含任何颜色/字体/像素；视觉全部来自 `templateId` + `theme`。换模板 = 换一组 CSS 变量与栅格规则，`Deck` 一字不动。

4. **互动块是内容块的一种**。它能被一句话生成、被模板适配、被多端呈现、被 PPT 改造时建议插入——因为它在结构上与文字图片平级。MVP 阶段 `runtime.live=false`，仅编排与静态呈现；Phase 2 置 `true` 接入实时会话，**Schema 不变**。

5. **生成来源同构**。一句话生成与 PPT 导入产出同一个 `Deck`，下游全部复用（`meta.source` 仅作埋点/提示用）。

## 校验策略

- 用 **Zod** 定义运行时 schema，前后端共用：LLM 产出 → 解析校验 → 不合规则重试/修复。
- LLM 调用走 **JSON mode / function-calling**，把 Zod schema 转为 JSON Schema 作为约束。
- 数据库存 `Deck` JSON 前再校验一次，保证持久化数据始终合法。

## 演进与迁移

- `Deck.version` 记录 schema 版本；新增块类型时写「向前兼容」的迁移函数。
- 渲染层对未知块类型降级为「不支持的内容」占位，不崩溃（利于灰度新块类型）。

## JSON 样例（节选）

```json
{
  "id": "deck_abc",
  "version": 1,
  "meta": { "title": "光合作用", "subject": "生物", "gradeLevel": "junior",
            "durationMinutes": 40, "language": "zh-CN", "source": "prompt" },
  "templateId": "tpl-academic-green",
  "sections": [{
    "id": "sec_1", "title": "导入：植物如何'吃饭'?",
    "slides": [{
      "id": "sld_1", "layout": "media-right", "pedagogyRole": "intro",
      "speakerNotes": "用提问引发好奇，2 分钟。",
      "blocks": [
        { "id": "b1", "type": "heading", "level": 1, "text": "植物如何获得能量？" },
        { "id": "b2", "type": "bulletList", "items": ["动物靠进食", "植物靠什么？", "今天揭晓"] },
        { "id": "b3", "type": "poll", "prompt": "你认为植物的'食物'主要来自？",
          "options": ["土壤","空气与阳光","水","肥料"], "runtime": { "live": false } }
      ]
    }]
  }]
}
```
