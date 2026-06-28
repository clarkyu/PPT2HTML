"use client";

/**
 * 路由段错误边界（App Router）。自动兜住各 server component 读路径（首页/详情/播放/编辑）
 * 在 DB 不可达或数据损坏时抛出的错误，给用户可恢复的重试入口，而非整页 500。
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <h1 className="font-heading text-xl font-bold">页面暂时无法加载</h1>
      <p className="mt-2 text-sm text-muted">
        服务出现临时问题（可能是数据连接不稳定），请稍后重试。
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-primary px-5 py-2.5 font-medium text-white shadow hover:opacity-90"
      >
        重试
      </button>
    </main>
  );
}
