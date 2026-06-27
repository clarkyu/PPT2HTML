import { notFound } from "next/navigation";
import { getDeck } from "@/lib/deck-store";
import { listTemplates } from "@/templates/registry";
import { DeckEditor } from "@/components/edit/DeckEditor";

// 课件来自运行时内存存储，按请求动态渲染。
export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await getDeck(id);
  if (!deck) notFound();
  return <DeckEditor deck={deck} templates={listTemplates()} />;
}
