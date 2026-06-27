/**
 * 单页渲染：按布局意图排布内容块。手机单列堆叠，md+ 按意图分栏。
 * 不感知是「概览卡片」还是「全屏播放」——尺寸由父容器决定，呈现自适应。
 *
 * reveal：是否揭示互动题答案。备课/概览视图为 true，授课投屏默认 false（避免提前暴露答案）。
 */
import type { Slide } from "@/schema/types";
import { BlockRenderer } from "./BlockRenderer";
import { getArrangement, getSlideClasses, getStackWidthClass } from "./layout";

export function SlideRenderer({ slide, reveal = false }: { slide: Slide; reveal?: boolean }) {
  const arrangement = getArrangement(slide);
  const align = getSlideClasses(slide.layout);
  const fill = slide.layout === "media-full";

  return (
    <div className={`flex h-full w-full flex-col gap-4 sm:gap-6 ${align}`}>
      {arrangement.kind === "stack" ? (
        <div className={`flex flex-col gap-4 sm:gap-6 ${getStackWidthClass(slide.layout)}`}>
          {arrangement.blocks.map((b) => (
            <BlockRenderer key={b.id} block={b} reveal={reveal} fill={fill} />
          ))}
        </div>
      ) : (
        <div className="flex w-full flex-col gap-4 sm:gap-6">
          {arrangement.header.length > 0 && (
            <div className="flex flex-col gap-2">
              {arrangement.header.map((b) => (
                <BlockRenderer key={b.id} block={b} reveal={reveal} />
              ))}
            </div>
          )}
          <div className="grid w-full grid-cols-1 items-start gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              {arrangement.primary.map((b) => (
                <BlockRenderer key={b.id} block={b} reveal={reveal} />
              ))}
            </div>
            <div className="flex flex-col gap-4">
              {arrangement.secondary.map((b) => (
                <BlockRenderer key={b.id} block={b} reveal={reveal} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
