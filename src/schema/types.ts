/**
 * 课件数据模型 · 权威 TypeScript 类型
 *
 * 这是整个产品的枢纽：生成、导入、渲染、编辑、导出、互动六件事都围绕它。
 * 设计原则见 docs/03-data-model.md：
 *  - 结构化内容与渲染分离（Deck 不含任何颜色/字体/像素）
 *  - 页存「内容块 + 布局意图」，不存固定坐标（多端自适应）
 *  - 互动块是内容块的一等公民（MVP 编排+静态呈现，Phase 2 实时运行）
 */

// ===== 顶层 =====

export interface Deck {
  id: string;
  version: number; // schema/乐观锁版本
  meta: DeckMeta;
  templateId: string; // 见 templates 注册表
  theme?: ThemeOverride; // 在模板之上的个性化覆盖
  sections: Section[];
  createdAt: string;
  updatedAt: string;
}

export interface DeckMeta {
  title: string;
  subject?: string; // 学科
  gradeLevel?: GradeLevel; // 学段
  durationMinutes?: number; // 课时
  language: string; // 默认 'zh-CN'
  objectives?: string[]; // 教学目标
  source: DeckSource; // 生成来源
}

export type DeckSource = "prompt" | "pptx-import";

export type GradeLevel =
  | "preschool"
  | "primary"
  | "junior"
  | "senior"
  | "vocational"
  | "higher"
  | "adult";

// ===== 节 / 页 =====

export interface Section {
  id: string;
  title: string;
  summary?: string;
  slides: Slide[];
}

export interface Slide {
  id: string;
  layout: SlideLayout; // 布局意图，渲染层按端落地
  blocks: Block[];
  speakerNotes?: string; // 演讲者备注 (F9)
  transition?: SlideTransition;
  pedagogyRole?: PedagogyRole; // 教学法角色
}

export type SlideTransition = "none" | "fade" | "slide";

// 教学法结构：导入—讲解—举例—互动—小结 (F4)
export type PedagogyRole =
  | "cover"
  | "intro"
  | "explain"
  | "example"
  | "interaction"
  | "summary";

// 布局意图（语义化，渲染层映射为各端栅格）
export type SlideLayout =
  | "title"
  | "single"
  | "two-column"
  | "media-left"
  | "media-right"
  | "media-full"
  | "centered";

// ===== 内容块（可辨识联合，按 type 区分） =====

export type Block = ContentBlock | InteractiveBlock;

export type ContentBlock =
  | HeadingBlock
  | TextBlock
  | BulletListBlock
  | ImageBlock
  | CodeBlock
  | QuoteBlock
  | TableBlock
  | MediaBlock
  | FormulaBlock;

export interface BlockBase {
  id: string;
}

export interface HeadingBlock extends BlockBase {
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
}

export interface TextBlock extends BlockBase {
  type: "text";
  text: string;
  emphasis?: boolean;
}

export interface BulletListBlock extends BlockBase {
  type: "bulletList";
  ordered?: boolean;
  items: string[];
}

export interface ImageBlock extends BlockBase {
  type: "image";
  src: string;
  alt?: string;
  caption?: string;
}

export interface CodeBlock extends BlockBase {
  type: "code";
  language: string;
  code: string;
}

export interface QuoteBlock extends BlockBase {
  type: "quote";
  text: string;
  cite?: string;
}

export interface TableBlock extends BlockBase {
  type: "table";
  headers: string[];
  rows: string[][];
}

export interface MediaBlock extends BlockBase {
  type: "media";
  kind: "video" | "audio";
  src: string;
}

export interface FormulaBlock extends BlockBase {
  type: "formula";
  latex: string; // 学科准确性（公式）
}

// ===== 互动块（一等公民） =====
// MVP：仅编排 + 静态呈现（runtime.live=false）
// Phase 2：置 runtime.live=true 接入实时会话，Schema 不变

export type InteractiveBlock =
  | PollBlock
  | McqBlock
  | TrueFalseBlock
  | QuizBlock
  | DiscussionWallBlock
  | WordCloudBlock;

export interface InteractiveRuntime {
  live: boolean;
  sessionId?: string;
}

export interface InteractiveBase extends BlockBase {
  prompt: string; // 题干/问题
  runtime?: InteractiveRuntime;
}

export interface PollBlock extends InteractiveBase {
  type: "poll";
  options: string[];
  multi?: boolean;
}

export interface McqBlock extends InteractiveBase {
  type: "mcq";
  options: string[];
  answerIndex: number;
  explanation?: string;
}

export interface TrueFalseBlock extends InteractiveBase {
  type: "trueFalse";
  answer: boolean;
  explanation?: string;
}

export interface QuizBlock extends InteractiveBase {
  type: "quiz";
  questions: McqBlock[];
  timeLimitSec?: number;
}

export interface DiscussionWallBlock extends InteractiveBase {
  type: "discussionWall";
  mode: "danmu" | "list";
}

export interface WordCloudBlock extends InteractiveBase {
  type: "wordCloud";
}

export type BlockType = Block["type"];

// ===== 主题 / 模板 =====

export interface ColorTokens {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
}

export interface ThemeOverride {
  colors?: Partial<ColorTokens>;
  fontFamily?: { heading?: string; body?: string };
  fontScale?: number;
  logoUrl?: string; // 校徽/个人标识
}

export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  colors: ColorTokens;
  fontFamily: { heading: string; body: string };
}
