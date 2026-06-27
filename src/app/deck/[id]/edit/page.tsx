import { notFound } from "next/navigation";
import { getDeck } from "@/lib/deck-store";
import { listTemplates } from "@/templates/registry";
import { SlideRenderer } from "@/renderer/SlideRenderer";
import { flattenSlides } from "@/renderer/flatten";
import { DeckEditor } from "@/components/edit/DeckEditor";

// 课件来自运行时内存存储，按请求动态渲染。
export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await getDeck(id);
  if (!deck) notFound();

  // 幻灯片服务端预渲染传入（同播放器），避免把 KaTeX/渲染器打进编辑页客户端包。
  const flat = flattenSlides(deck);
  const slides = flat.map((f) => <SlideRenderer key={f.slide.id} slide={f.slide} reveal />);
  const sectionTitles = flat.map((f) => f.sectionTitle);

  return (
    <DeckEditor
      deck={deck}
      templates={listTemplates()}
      slides={slides}
      sectionTitles={sectionTitles}
    />
  );
}
