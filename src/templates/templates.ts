/**
 * 一组专业模板（M1 内置 3 套，覆盖常见教学风格）。
 * 模板只描述「视觉」（配色、字体）；课件内容与之分离，换模板内容不变。
 * 见 docs/03-data-model.md、docs/05-mvp-scope.md (F5)。
 */
import type { Template } from "@/schema/types";

export const templates: Template[] = [
  {
    id: "tpl-academic-green",
    name: "学术绿",
    description: "沉稳的学术风，衬线标题，适合理科与讲解型课堂。",
    thumbnail: "/templates/academic-green.svg",
    colors: {
      // primary 取较深绿，使白字按钮对比度达 WCAG AA（白字 on #0E6B4F ≈ 6.5:1）
      primary: "#0E6B4F",
      secondary: "#475569",
      accent: "#EAB308",
      background: "#FFFFFF",
      surface: "#F1F7F4",
      text: "#0F172A",
      muted: "#64748B",
    },
    fontFamily: {
      heading: "Georgia, 'Songti SC', 'STSong', serif",
      body: "ui-sans-serif, system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    },
  },
  {
    id: "tpl-classic-blue",
    name: "经典蓝",
    description: "清晰的通用风，无衬线，适合大多数学科与正式场合。",
    thumbnail: "/templates/classic-blue.svg",
    colors: {
      primary: "#2563EB",
      secondary: "#475569",
      accent: "#F59E0B",
      background: "#FFFFFF",
      surface: "#F1F5F9",
      text: "#0F172A",
      muted: "#64748B",
    },
    fontFamily: {
      heading: "ui-sans-serif, system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif",
      body: "ui-sans-serif, system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    },
  },
  {
    id: "tpl-warm-coral",
    name: "暖珊瑚",
    description: "温暖活泼的风格，适合文科、低学段与互动性强的课堂。",
    thumbnail: "/templates/warm-coral.svg",
    colors: {
      primary: "#E11D48",
      secondary: "#9F1239",
      accent: "#F59E0B",
      background: "#FFFBF7",
      surface: "#FFF1E7",
      text: "#1C1917",
      muted: "#78716C",
    },
    fontFamily: {
      heading: "ui-rounded, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
      body: "ui-sans-serif, system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    },
  },
];

export const DEFAULT_TEMPLATE_ID = "tpl-classic-blue";
