import Link from "next/link";
import { listDecks } from "@/lib/deck-store";
import { getTemplate } from "@/templates/registry";

const GRADE_LABELS: Record<string, string> = {
  preschool: "学前",
  primary: "小学",
  junior: "初中",
  senior: "高中",
  vocational: "职教",
  higher: "高校",
  adult: "成人",
};

export default async function HomePage() {
  const decks = await listDecks();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">言课 · YanKe</p>
          <h1 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">我的课件</h1>
          <p className="mt-2 text-sm text-muted">点击课件可预览，或直接「开始授课」全屏播放。</p>
        </div>
        <Link
          href="/create"
          className="rounded-lg bg-primary px-5 py-2.5 font-medium text-white shadow hover:opacity-90"
        >
          ✨ 一句话生成
        </Link>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {decks.map((d) => {
          const template = getTemplate(d.templateId);
          return (
            <div
              key={d.id}
              className="flex flex-col justify-between rounded-xl border border-muted/20 bg-surface p-5 shadow-sm transition hover:shadow-md"
            >
              <Link href={`/deck/${d.id}`} className="block">
                <h2 className="font-heading text-lg font-semibold text-foreground">{d.title}</h2>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                  {d.subject && <span>{d.subject}</span>}
                  {d.gradeLevel && <span>· {GRADE_LABELS[d.gradeLevel]}</span>}
                  <span>· {d.slideCount} 页</span>
                  <span>· {template.name}</span>
                </div>
              </Link>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/deck/${d.id}`}
                  className="rounded-lg border border-muted/30 px-3 py-1.5 text-sm text-foreground hover:bg-background"
                >
                  预览
                </Link>
                <Link
                  href={`/deck/${d.id}/play`}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  ▶ 开始授课
                </Link>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
