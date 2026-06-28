/**
 * Service Worker 源（由 @serwist/next 在构建期编译为 /public/sw.js）。
 * 预缓存构建产物 + 运行时缓存策略；文档请求离线无缓存时回退 /~offline。
 * 注：本文件以 WebWorker 环境编译（见 tsconfig.sw.json / typecheck:sw），从应用主 tsconfig 排除。
 */
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  // 不设 clientsClaim：不强制接管已打开的旧标签页，避免授课/投屏长会话中途被新 SW 抢占、
  // 旧 chunk 被新预缓存清理而触发 ChunkLoadError（版本错配）。
  navigationPreload: true,
  runtimeCaching: [
    {
      // 个性化首页（「我的课件」+脱敏手机号）与所有 /api：仅走网络、不写缓存，
      // 杜绝共享设备上跨会话回放登录态内容；离线时经 fallback 落到 /~offline。
      // /deck/* 仍按默认策略缓存：课件正文按链接公开（产品决策），可离线查看与授课。
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && (url.pathname === "/" || url.pathname.startsWith("/api/")),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
