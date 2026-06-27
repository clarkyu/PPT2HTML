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
  // xl: 台阶为教室投影/大屏放大字号，保证后排可读（M1 出口标准：全屏授课可读）。
  const cls = "font-heading font-bold text-foreground";
  if (block.level === 1)
    return <h1 className={`${cls} text-3xl sm:text-4xl lg:text-5xl xl:text-6xl`}>{block.text}</h1>;
  if (block.level === 2)
    return <h2 className={`${cls} text-2xl sm:text-3xl xl:text-4xl`}>{block.text}</h2>;
  return <h3 className={`${cls} text-xl sm:text-2xl xl:text-3xl`}>{block.text}</h3>;
}

export function Text({ block }: { block: TextBlock }) {
  return (
    <p
      className={`leading-relaxed text-foreground/90 text-base sm:text-lg xl:text-xl ${
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
      className={`space-y-2 text-base sm:text-lg xl:text-xl text-foreground/90 ${
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
      <pre className="overflow-x-auto p-4 text-sm">
        <code className="font-mono text-foreground/90">{block.code}</code>
      </pre>
    </div>
  );
}

export function Quote({ block }: { block: QuoteBlock }) {
  return (
    <blockquote className="border-l-4 border-primary bg-surface/60 px-4 py-3 italic text-foreground/90">
      <p className="text-base sm:text-lg xl:text-xl">{block.text}</p>
      {block.cite && <cite className="mt-1 block text-sm not-italic text-muted">— {block.cite}</cite>}
    </blockquote>
  );
}

export function Table({ block }: { block: TableBlock }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm sm:text-base">
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
