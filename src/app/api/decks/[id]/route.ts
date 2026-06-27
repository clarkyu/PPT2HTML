import { NextResponse } from "next/server";
import type { Deck } from "@/schema/types";
import { deckSchema } from "@/schema/zod";
import { getDeck, saveDeck } from "@/lib/deck-store";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 读取单份课件（课件即可寻址的链接，读取为公开能力；权限控制属后续项）。 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await getDeck(id);
  if (!deck) return NextResponse.json({ error: "课件不存在" }, { status: 404 });
  return NextResponse.json({ deck });
}

/** 保存对已有课件的编辑（模板/主题/内容）。整份 Deck 经 deckSchema 校验后落库。 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!rateLimit(`edit:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  try {
    const existing = await getDeck(id);
    if (!existing) {
      return NextResponse.json({ error: "课件不存在" }, { status: 404 });
    }
    const parsed = deckSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "课件数据不合法" }, { status: 400 });
    }
    if (parsed.data.id !== id) {
      return NextResponse.json({ error: "课件 id 不匹配" }, { status: 400 });
    }
    const deck = { ...parsed.data, updatedAt: new Date().toISOString() } as Deck;
    await saveDeck(deck);
    return NextResponse.json({ id: deck.id });
  } catch (e) {
    return errorResponse(e, "保存失败");
  }
}
