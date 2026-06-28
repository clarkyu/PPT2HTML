import withSerwistInit from "@serwist/next";

// PWA（Serwist）：构建期把 src/app/sw.ts 编译为 /public/sw.js 并自动注册。
// 开发环境禁用，避免 HMR 与缓存干扰；生产构建启用离线能力。
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withSerwist(nextConfig);
