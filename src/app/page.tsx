import Link from "next/link";
import { auth, signOut } from "@/auth";
import { listDecks } from "@/lib/deck-store";
import { getTemplate } from "@/templates/registry";
import { ImportButton } from "@/components/import/ImportButton";
import { maskPhone } from "@/auth/phone";

const GRADE_LABELS: Record<string, string> = {
  preschool: "学前",
  primary: "小学",
  junior: "初中",
  senior: "高中",
  vocational: "职教",
  higher: "高校",
  adult: "成人",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const user = session?.user;

  // 登录后展示「我的课件」；DB 抖动时优雅降级，保留导入/生成入口可用。
  let decks: Awaited<ReturnType<typeof listDecks>> = [];
  let listFailed = false;
  if (user?.id) {
    try {
      decks = await listDecks(user.id);
    } catch {
      listFailed = true;
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">言课 · YanKe</p>
          <h1 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">
            {user ? "我的课件" : "老师只负责提升想法，实现交给言课"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {user ? "点击课件可预览，或直接「开始授课」全屏播放。" : "一句话，或一份旧 PPT，生成网页版课件。"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user ? (
            <>
              <span className="text-sm text-muted">{maskPhone(user.phone)}</span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button className="rounded-lg border border-muted/30 px-3 py-2 text-sm text-foreground hover:bg-surface">
                  退出
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-muted/30 px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
            >
              登录
            </Link>
          )}
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <ImportButton />
        <Link
          href="/create"
          className="rounded-lg bg-primary px-5 py-2.5 font-medium text-white shadow hover:opacity-90"
        >
          ✨ 一句话生成
        </Link>
      </div>

      {listFailed && (
        <p className="mt-8 rounded-lg border border-muted/20 bg-surface px-4 py-3 text-sm text-muted">
          课件列表暂时无法加载，请稍后重试。你仍可导入 PPT 或一句话生成新课件。
        </p>
      )}

      {!user && (
        <p className="mt-8 rounded-lg border border-muted/20 bg-surface px-4 py-3 text-sm text-muted">
          未登录也能生成与导入（课件按链接公开可访问）。
          <Link href="/login" className="ml-1 font-medium text-primary hover:underline">
            登录
          </Link>
          后即可保存、管理你的课件。
        </p>
      )}

      {user && !listFailed && decks.length === 0 && (
        <p className="mt-8 rounded-lg border border-dashed border-muted/30 px-4 py-8 text-center text-sm text-muted">
          还没有课件。点击上方「一句话生成」或导入一份 PPT 开始吧。
        </p>
      )}

      {decks.length > 0 && (
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
      )}
    </main>
  );
}
