import { sampleDeck } from "@/schema/fixtures/sample-deck";

/**
 * 占位首页：标示项目处于「规划与脚手架」阶段，并展示示例课件的结构概览，
 * 验证数据模型可被读取。真正的创作入口（F1）、渲染层（M1）、生成闭环（M2）
 * 见 docs/07-task-breakdown.md。
 */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium text-primary">言课 · YanKe</p>
      <h1 className="mt-2 font-heading text-3xl font-bold">
        老师只负责提升想法，实现交给言课
      </h1>
      <p className="mt-4 text-muted">
        AI 原生的智能课件平台 · 手机优先 · 多端自适应 PWA。当前仓库处于
        <strong className="text-foreground"> 规划与脚手架阶段</strong>。
      </p>

      <section className="mt-10 rounded-lg border border-muted/20 bg-surface p-5">
        <h2 className="font-heading text-lg font-semibold">脚手架自检：示例课件</h2>
        <p className="mt-1 text-sm text-muted">
          下方数据读取自 <code>src/schema/fixtures/sample-deck.ts</code>，
          证明课件数据模型已就绪、可被读取与渲染。
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Stat label="标题" value={sampleDeck.meta.title} />
          <Stat label="学科 / 学段" value={`${sampleDeck.meta.subject} · ${sampleDeck.meta.gradeLevel}`} />
          <Stat label="节数" value={String(sampleDeck.sections.length)} />
          <Stat
            label="页数"
            value={String(sampleDeck.sections.reduce((n, s) => n + s.slides.length, 0))}
          />
        </dl>
      </section>

      <p className="mt-8 text-sm text-muted">
        规划文档见 <code>/docs</code>。下一步：按 <code>docs/07-task-breakdown.md</code>
        的关键路径开始编码（渲染层 → 生成闭环）。
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}
