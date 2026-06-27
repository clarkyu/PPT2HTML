/**
 * 主题容器：把「模板 + theme 覆盖」编译出的 CSS 变量挂在根节点上，
 * 内部所有块即按该主题着色。换模板只换这层变量，内容结构不变。
 */
import type { CSSProperties } from "react";
import type { Deck } from "@/schema/types";
import { getTemplate } from "@/templates/registry";
import { buildThemeVars } from "@/templates/theme";

export function ThemedSurface({
  deck,
  className = "",
  style,
  children,
}: {
  deck: Pick<Deck, "templateId" | "theme">;
  className?: string;
  style?: CSSProperties;
  children: React.ReactNode;
}) {
  const template = getTemplate(deck.templateId);
  const vars = buildThemeVars(template, deck.theme);
  return (
    <div
      style={{ ...vars, fontFamily: "var(--font-body)", ...style }}
      className={`bg-background text-foreground ${className}`}
    >
      {children}
    </div>
  );
}
