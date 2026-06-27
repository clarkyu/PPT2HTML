/**
 * 块分发器：按 block.type 渲染对应组件。
 * 未知/未来的块类型降级为占位提示，不让整页崩溃（docs/03-data-model.md 的向前兼容策略）。
 */
import type { Block } from "@/schema/types";
import {
  BulletList,
  Code,
  Heading,
  ImageView,
  Media,
  Quote,
  Table,
  Text,
} from "./blocks/ContentBlocks";
import { Formula } from "./blocks/Formula";
import {
  DiscussionWall,
  Mcq,
  Poll,
  Quiz,
  TrueFalse,
  WordCloud,
} from "./blocks/InteractiveBlocks";

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <Heading block={block} />;
    case "text":
      return <Text block={block} />;
    case "bulletList":
      return <BulletList block={block} />;
    case "image":
      return <ImageView block={block} />;
    case "code":
      return <Code block={block} />;
    case "quote":
      return <Quote block={block} />;
    case "table":
      return <Table block={block} />;
    case "media":
      return <Media block={block} />;
    case "formula":
      return <Formula block={block} />;
    case "poll":
      return <Poll block={block} />;
    case "mcq":
      return <Mcq block={block} />;
    case "trueFalse":
      return <TrueFalse block={block} />;
    case "quiz":
      return <Quiz block={block} />;
    case "discussionWall":
      return <DiscussionWall block={block} />;
    case "wordCloud":
      return <WordCloud block={block} />;
  }

  // 未知类型（如灰度中的新块类型）：降级占位。
  const unknownType = (block as { type?: string }).type ?? "unknown";
  return (
    <div className="rounded-lg border border-dashed border-muted/40 bg-surface px-3 py-2 text-sm text-muted">
      暂不支持的内容块：{unknownType}
    </div>
  );
}
