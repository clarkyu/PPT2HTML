"use client";

/**
 * 客户端幻灯片渲染（编辑器专用）：编辑后需即时反映改动，故在客户端按 deck 状态重渲染。
 * 经 next/dynamic({ ssr:false }) 懒加载，KaTeX 仅在编辑器实际渲染已改动页时按需加载，
 * 不影响播放/概览（仍走服务端渲染），也不进编辑页的初始包。
 */
import type { Slide } from "@/schema/types";
import { SlideRenderer } from "@/renderer/SlideRenderer";

export default function ClientSlideRenderer({ slide }: { slide: Slide }) {
  return <SlideRenderer slide={slide} reveal />;
}
