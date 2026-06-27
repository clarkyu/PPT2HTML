import { notFound } from "next/navigation";
import { getDeck } from "@/lib/deck-store";
import { SlideRenderer } from "@/renderer/SlideRenderer";
import { flattenSlides } from "@/renderer/flatten";
import { getTemplate } from "@/templates/registry";
import { buildThemeVars } from "@/templates/theme";
import { Player } from "@/player/Player";

// 同 /deck/[id]：运行时课件按请求动态渲染（见 deck-store 的过渡实现说明）。
export const dynamic = "force-dynamic";

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await getDeck(id);
  if (!deck) notFound();

  const flat = flattenSlides(deck);

  // 幻灯片在服务端预渲染；投屏授课默认不揭示答案（reveal=false）。
  const slides = flat.map((f) => <SlideRenderer key={f.slide.id} slide={f.slide} reveal={false} />);
  const notes = flat.map((f) => f.slide.speakerNotes);
  const sectionTitles = flat.map((f) => f.sectionTitle);
  const themeVars = buildThemeVars(getTemplate(deck.templateId), deck.theme);

  return (
    <Player
      title={deck.meta.title}
      deckId={deck.id}
      themeVars={themeVars}
      slides={slides}
      notes={notes}
      sectionTitles={sectionTitles}
    />
  );
}
