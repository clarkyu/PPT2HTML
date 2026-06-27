/**
 * 单页渲染：按布局意图排布内容块。手机单列堆叠，md+ 按意图分栏。
 * 不感知是「概览卡片」还是「全屏播放」——尺寸由父容器决定，呈现自适应。
 */
import type { Slide } from "@/schema/types";
import { BlockRenderer } from "./BlockRenderer";
import { getArrangement, getSlideClasses } from "./layout";

export function SlideRenderer({ slide }: { slide: Slide }) {
  const arrangement = getArrangement(slide);
  const align = getSlideClasses(slide.layout);

  return (
    <div className={`flex h-full w-full flex-col gap-4 sm:gap-6 ${align}`}>
      {arrangement.kind === "stack" ? (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-6">
          {arrangement.blocks.map((b) => (
            <BlockRenderer key={b.id} block={b} />
          ))}
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 items-center gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            {arrangement.primary.map((b) => (
              <BlockRenderer key={b.id} block={b} />
            ))}
          </div>
          <div className="flex flex-col gap-4">
            {arrangement.secondary.map((b) => (
              <BlockRenderer key={b.id} block={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
