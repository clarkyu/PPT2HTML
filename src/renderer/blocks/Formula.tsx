/**
 * 公式块：用 KaTeX 服务端渲染 LaTeX，保证学科准确性（公式不失真）。
 * 渲染失败时降级为原始 LaTeX 文本，不让整页崩溃。
 */
import katex from "katex";
import "katex/dist/katex.min.css";
import type { FormulaBlock } from "@/schema/types";

export function Formula({ block }: { block: FormulaBlock }) {
  let html: string;
  try {
    html = katex.renderToString(block.latex, {
      displayMode: true,
      throwOnError: false,
    });
  } catch {
    return (
      <pre className="overflow-x-auto rounded-lg bg-surface p-4 text-center font-mono text-sm text-foreground/90">
        {block.latex}
      </pre>
    );
  }
  return (
    <div
      className="overflow-x-auto py-2 text-center text-foreground"
      // KaTeX 输出为可信的本地渲染结果
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
