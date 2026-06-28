import Link from "next/link";

// 离线兜底页：文档请求在离线且无缓存时由 Service Worker 回退到此（见 src/app/sw.ts）。
export const metadata = { title: "离线 · 言课" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="text-4xl">📡</div>
      <h1 className="mt-4 font-heading text-xl font-bold">当前处于离线状态</h1>
      <p className="mt-2 text-sm text-muted">
        这个页面尚未缓存，无法离线打开。已经访问过的课件仍可在离线时继续查看与授课。
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-primary px-5 py-2.5 font-medium text-white shadow hover:opacity-90"
      >
        返回首页
      </Link>
    </main>
  );
}
