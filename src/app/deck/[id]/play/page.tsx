import { notFound } from "next/navigation";
import { getDeck, listDeckIds } from "@/lib/deck-store";
import { SlideRenderer } from "@/renderer/SlideRenderer";
import { flattenSlides } from "@/renderer/flatten";
import { Player } from "@/player/Player";

export async function generateStaticParams() {
  return (await listDeckIds()).map((id) => ({ id }));
}

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await getDeck(id);
  if (!deck) notFound();

  const flat = flattenSlides(deck);

  // 幻灯片在服务端预渲染，作为 ReactNode 传给客户端播放器
  const slides = flat.map((f) => <SlideRenderer key={f.slide.id} slide={f.slide} />);
  const notes = flat.map((f) => f.slide.speakerNotes);
  const sectionTitles = flat.map((f) => f.sectionTitle);

  return (
    <Player
      title={deck.meta.title}
      deckId={deck.id}
      themeRef={{ templateId: deck.templateId, theme: deck.theme }}
      slides={slides}
      notes={notes}
      sectionTitles={sectionTitles}
    />
  );
}
