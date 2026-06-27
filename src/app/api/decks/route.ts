import { NextResponse } from "next/server";
import { z } from "zod";
import { assembleDeck, pickTemplate } from "@/ai/pipeline";
import { draftSectionSchema, intentCardSchema } from "@/ai/schemas";
import { deckSchema } from "@/schema/zod";
import { newDeckId, saveDeck } from "@/lib/deck-store";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  intent: intentCardSchema,
  drafts: z.array(draftSectionSchema).min(1).max(30),
  templateId: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`save:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
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

    // 持久化前再校验，保证库中数据始终合法（兑现 schema 契约）。
    const check = deckSchema.safeParse(deck);
    if (!check.success) {
      return errorResponse(check.error, "课件组装结果不合法");
    }

    await saveDeck(deck);
    return NextResponse.json({ id: deck.id });
  } catch (e) {
    return errorResponse(e, "保存失败");
  }
}
