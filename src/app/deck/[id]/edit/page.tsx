import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDeckRecord } from "@/lib/deck-store";
import { listTemplates } from "@/templates/registry";
import { SlideRenderer } from "@/renderer/SlideRenderer";
import { flattenSlides } from "@/renderer/flatten";
import { DeckEditor } from "@/components/edit/DeckEditor";

// 课件来自运行时存储，按请求动态渲染。
export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 写入口前置门控：未登录引导登录；他人已归属课件不暴露编辑器（与「读取按链接公开」不冲突，仅禁写）。
  const [session, rec] = await Promise.all([auth(), getDeckRecord(id)]);
  if (!rec) notFound();
  if (!session?.user?.id) redirect(`/login?next=/deck/${id}/edit`);
  if (rec.ownerId && rec.ownerId !== session.user.id) notFound();
  const deck = rec.deck;

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
