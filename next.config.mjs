import withSerwistInit from "@serwist/next";

// /~offline 离线兜底页每次构建用新 revision 重新预缓存（内容变更即随部署更新）。
const offlineRevision = String(Date.now());

// PWA（Serwist）：构建期把 src/app/sw.ts 编译为 /public/sw.js 并自动注册。
// 开发环境禁用，避免 HMR 与缓存干扰；生产构建启用离线能力。
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // /~offline 是 App Router 页面，其可导航 HTML 不在 @serwist/next 默认清单内（server/ 命名空间被排除）。
  // 显式追加为预缓存项（仅追加、不替换 public/ glob），使 sw.ts 的离线 fallback(matchPrecache) 能解析到它。
  manifestTransforms: [
    async (entries) => {
      entries.push({ url: "/~offline", revision: offlineRevision, size: 0 });
      return { manifest: entries, warnings: [] };
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // playwright-core 仅在 PDF 导出路由的 node 运行时按需加载，不打进构建产物。
  serverExternalPackages: ["playwright-core"],
};

export default withSerwist(nextConfig);
