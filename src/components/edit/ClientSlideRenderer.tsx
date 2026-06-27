"use client";

/**
 * 客户端幻灯片渲染（编辑器专用）：编辑后需即时反映改动，故在客户端按 deck 状态重渲染。
 * 经 next/dynamic({ ssr:false }) 懒加载：KaTeX 的 JS（renderToString）拆到惰性 chunk，
 * 不进编辑页初始 JS、不影响播放/概览（仍服务端渲染）。
 * 注：katex.min.css 仍随该路由的 CSS 收集进初始样式（约 25KB），属可接受成本。
 */
import type { Slide } from "@/schema/types";
import { SlideRenderer } from "@/renderer/SlideRenderer";

export default function ClientSlideRenderer({ slide }: { slide: Slide }) {
  return <SlideRenderer slide={slide} reveal />;
}
