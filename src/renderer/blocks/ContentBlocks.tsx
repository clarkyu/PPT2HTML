/**
 * 内容块渲染组件（呈现型，无状态，可作为服务端组件）。
 * 视觉全部走主题 CSS 变量（foreground / primary / muted / surface ...）。
 */
import type {
  BulletListBlock,
  CodeBlock,
  HeadingBlock,
  ImageBlock,
  MediaBlock,
  QuoteBlock,
  TableBlock,
  TextBlock,
} from "@/schema/types";

export function Heading({ block }: { block: HeadingBlock }) {
  // 字号用 em，相对渲染容器基准（--slide-base × --font-scale）缩放：
  // 既支持用户字号自定义，也由播放器按视口放大基准以适配投影大屏。
  const cls = "font-heading font-bold leading-tight text-foreground";
  if (block.level === 1) return <h1 className={`${cls} text-[2.4em]`}>{block.text}</h1>;
  if (block.level === 2) return <h2 className={`${cls} text-[1.7em]`}>{block.text}</h2>;
  return <h3 className={`${cls} text-[1.35em]`}>{block.text}</h3>;
}

export function Text({ block }: { block: TextBlock }) {
  return (
    <p
      className={`text-[1.05em] leading-relaxed text-foreground/90 ${
        block.emphasis ? "font-semibold text-primary" : ""
      }`}
    >
      {block.text}
    </p>
  );
}

export function BulletList({ block }: { block: BulletListBlock }) {
  const Tag = block.ordered ? "ol" : "ul";
  return (
    <Tag
      className={`space-y-2 text-[1.05em] text-foreground/90 ${
        block.ordered ? "list-decimal" : "list-disc"
      } pl-6 marker:text-primary`}
    >
      {block.items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </Tag>
  );
}

export function ImageView({ block, fill = false }: { block: ImageBlock; fill?: boolean }) {
  return (
    <figure className="space-y-2">
      {/* 任意外链图片，使用原生 img 避免 next/image 的域名白名单约束 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.src}
        alt={block.alt ?? ""}
        className={`${fill ? "max-h-[80vh]" : "max-h-[60vh]"} w-full rounded-lg object-contain`}
      />
      {block.caption && (
        <figcaption className="text-center text-sm text-muted">{block.caption}</figcaption>
      )}
    </figure>
  );
}

export function Code({ block }: { block: CodeBlock }) {
  return (
    <div className="overflow-hidden rounded-lg border border-muted/20 bg-surface">
      <div className="border-b border-muted/20 px-4 py-1.5 text-xs text-muted">
        {block.language || "code"}
      </div>
      <pre className="overflow-x-auto p-4 text-[0.85em]">
        <code className="font-mono text-foreground/90">{block.code}</code>
      </pre>
    </div>
  );
}

export function Quote({ block }: { block: QuoteBlock }) {
  return (
    <blockquote className="border-l-4 border-primary bg-surface/60 px-4 py-3 italic text-foreground/90">
      <p className="text-[1.05em]">{block.text}</p>
      {block.cite && <cite className="mt-1 block text-[0.85em] not-italic text-muted">— {block.cite}</cite>}
    </blockquote>
  );
}

export function Table({ block }: { block: TableBlock }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[0.95em]">
        <thead>
          <tr>
            {block.headers.map((h, i) => (
              <th
                key={i}
                scope="col"
                className="border-b-2 border-primary/40 px-3 py-2 font-semibold text-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r} className="odd:bg-surface/50">
              {row.map((cell, c) => (
                <td key={c} className="border-b border-muted/20 px-3 py-2 text-foreground/90">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Media({ block, fill = false }: { block: MediaBlock; fill?: boolean }) {
  if (block.kind === "video") {
    return (
      <video
        src={block.src}
        controls
        className={`${fill ? "max-h-[80vh]" : "max-h-[60vh]"} w-full rounded-lg`}
      />
    );
  }
  return <audio src={block.src} controls className="w-full" />;
}
