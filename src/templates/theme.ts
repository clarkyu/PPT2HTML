/**
 * 主题应用：把「模板 + 个性化覆盖(theme)」编译为一组 CSS 变量。
 * 渲染层把这些变量挂在课件根容器上，Tailwind 颜色（rgb(var(--color-*))）即据此生效。
 * 这就是「换模板而内容不变」的落地点：只改变量，不改内容结构。
 */
import type { CSSProperties } from "react";
import type { ColorTokens, Template, ThemeOverride } from "@/schema/types";

/** "#168A63" -> "22 138 99"（配合 tailwind 的 <alpha-value>，见 tailwind.config.ts）。 */
export function hexToTriplet(hex: string): string {
  const m = hex.trim().replace(/^#/, "");
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "0 0 0";
  return `${r} ${g} ${b}`;
}

type ThemeVars = CSSProperties & Record<`--${string}`, string | number>;

export function buildThemeVars(
  template: Template,
  override?: ThemeOverride,
): ThemeVars {
  const colors: ColorTokens = { ...template.colors, ...override?.colors };
  const heading = override?.fontFamily?.heading ?? template.fontFamily.heading;
  const body = override?.fontFamily?.body ?? template.fontFamily.body;

  const vars: ThemeVars = {
    "--color-primary": hexToTriplet(colors.primary),
    "--color-secondary": hexToTriplet(colors.secondary),
    "--color-accent": hexToTriplet(colors.accent),
    "--color-background": hexToTriplet(colors.background),
    "--color-surface": hexToTriplet(colors.surface),
    "--color-text": hexToTriplet(colors.text),
    "--color-muted": hexToTriplet(colors.muted),
    "--font-heading": heading,
    "--font-body": body,
    // 预留钩子：M3「基础自定义」接入字号缩放时由排版消费；M1 typography 暂未引用。
    "--font-scale": override?.fontScale ?? 1,
  };
  return vars;
}
