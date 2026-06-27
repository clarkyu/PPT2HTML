import { NextResponse } from "next/server";
import { z } from "zod";
import { assembleDeck, pickTemplate } from "@/ai/pipeline";
import { draftSectionSchema, intentCardSchema } from "@/ai/schemas";
import { newDeckId, saveDeck } from "@/lib/deck-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  intent: intentCardSchema,
  drafts: z.array(draftSectionSchema).min(1),
  templateId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "课件草稿数据不合法" }, { status: 400 });
    }
    const { intent, drafts, templateId } = parsed.data;
    const deck = assembleDeck(intent, drafts, {
      id: newDeckId(),
      now: new Date().toISOString(),
      templateId: templateId ?? pickTemplate(intent),
    });
    await saveDeck(deck);
    return NextResponse.json({ id: deck.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "保存失败" }, { status: 500 });
  }
}
