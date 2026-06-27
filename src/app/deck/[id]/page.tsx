import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeck, listDeckIds } from "@/lib/deck-store";
import { ThemedSurface } from "@/renderer/ThemedSurface";
import { SlideRenderer } from "@/renderer/SlideRenderer";
import { flattenSlides } from "@/renderer/flatten";
import { getTemplate } from "@/templates/registry";

export async function generateStaticParams() {
  return (await listDeckIds()).map((id) => ({ id }));
}

const GRADE_LABELS: Record<string, string> = {
  preschool: "学前",
  primary: "小学",
  junior: "初中",
  senior: "高中",
  vocational: "职教",
  higher: "高校",
  adult: "成人",
};

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await getDeck(id);
  if (!deck) notFound();

  const flat = flattenSlides(deck);
  const template = getTemplate(deck.templateId);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← 返回课件列表
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">{deck.meta.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {deck.meta.subject && <Chip>{deck.meta.subject}</Chip>}
            {deck.meta.gradeLevel && <Chip>{GRADE_LABELS[deck.meta.gradeLevel]}</Chip>}
            {deck.meta.durationMinutes && <Chip>{deck.meta.durationMinutes} 分钟</Chip>}
            <Chip>{flat.length} 页</Chip>
            <Chip>模板：{template.name}</Chip>
          </div>
        </div>
        <Link
          href={`/deck/${deck.id}/play`}
          className="rounded-lg bg-primary px-5 py-2.5 font-medium text-white shadow hover:opacity-90"
        >
          ▶ 开始授课
        </Link>
      </header>

      {deck.meta.objectives && deck.meta.objectives.length > 0 && (
        <section className="mt-6 rounded-lg border border-muted/20 bg-surface p-4">
          <h2 className="text-sm font-semibold text-muted">教学目标</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
            {deck.meta.objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 space-y-8">
        {deck.sections.map((section) => (
          <div key={section.id}>
            <h2 className="mb-3 font-heading text-lg font-semibold text-foreground/80">
              {section.title}
            </h2>
            <div className="space-y-4">
              {section.slides.map((slide) => {
                const idx = flat.findIndex((f) => f.slide.id === slide.id);
                return (
                  <div key={slide.id} className="overflow-hidden rounded-xl border border-muted/20 shadow-sm">
                    <div className="flex items-center justify-between bg-surface px-3 py-1.5 text-xs text-muted">
                      <span>第 {idx + 1} 页</span>
                      <span>{slide.layout}</span>
                    </div>
                    <ThemedSurface deck={deck} className="min-h-[240px] p-6 sm:p-8">
                      <SlideRenderer slide={slide} />
                    </ThemedSurface>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-surface px-2.5 py-1 text-muted ring-1 ring-muted/20">
      {children}
    </span>
  );
}
