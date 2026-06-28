import type { MetadataRoute } from "next";

// Web App Manifest（Next 在 /manifest.webmanifest 提供，并自动注入 <link rel="manifest">）。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "言课 · 智能课件平台",
    short_name: "言课",
    description: "老师只负责提升想法，实现交给言课。一句话生成网页版课件。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0e6b4f",
    lang: "zh-CN",
    dir: "ltr",
    orientation: "any",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
