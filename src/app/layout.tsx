import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "言课",
  title: "言课 · 智能课件平台",
  description: "老师只负责提升想法，实现交给言课。一句话生成网页版课件。",
  // app/manifest.ts 已存在，Next 自动注入 <link rel="manifest">；此处补 iOS 安装与图标。
  appleWebApp: { capable: true, statusBarStyle: "default", title: "言课" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon-180.png", sizes: "180x180" }],
  },
};

// 手机优先（PRD 第四章）。不限制 maximumScale：保留双指缩放，满足 WCAG 1.4.4（可放大正文/公式）。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e6b4f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
