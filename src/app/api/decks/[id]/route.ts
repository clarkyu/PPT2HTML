import { NextResponse } from "next/server";
import type { Deck } from "@/schema/types";
import { deckSchema } from "@/schema/zod";
import { getDeckRecord, saveDeck, VersionConflictError } from "@/lib/deck-store";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 读取单份课件（课件即可寻址的链接，读取为公开能力；权限控制属后续项）。 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // 读取限流：缩小无鉴权读取端点的枚举面（与资源端点同级）。
  if (!rateLimit(`deck:${clientIp(req)}`, 240, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  const { id } = await params;
  try {
    const rec = await getDeckRecord(id);
    if (!rec) return NextResponse.json({ error: "课件不存在" }, { status: 404 });
    return NextResponse.json({ deck: rec.deck });
  } catch (e) {
    return errorResponse(e, "读取失败");
  }
}

/** 保存对已有课件的编辑（模板/主题/内容）。整份 Deck 经 deckSchema 校验后落库。 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 双桶：按客户端 + 按课件（后者不依赖可伪造的请求头，兜底单课件高频覆盖）。
  if (!rateLimit(`edit:${clientIp(req)}`, 60, 60_000) || !rateLimit(`edit:deck:${id}`, 120, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  try {
    // 写操作需登录。
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    const existing = await getDeckRecord(id);
    if (!existing) {
      return NextResponse.json({ error: "课件不存在" }, { status: 404 });
    }
    // 归属校验：他人课件不可改；匿名课件（owner 为 null）由当前登录者认领。
    if (existing.ownerId && existing.ownerId !== userId) {
      return NextResponse.json({ error: "无权编辑该课件" }, { status: 403 });
    }
    const ownerId = existing.ownerId ?? userId;

    const parsed = deckSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "课件数据不合法" }, { status: 400 });
    }
    if (parsed.data.id !== id) {
      return NextResponse.json({ error: "课件 id 不匹配" }, { status: 400 });
    }
    // 服务端为权威：创建时间与来源不可被客户端改写，version 由服务端自增。
    const expectedVersion = parsed.data.version;
    const deck: Deck = {
      ...parsed.data,
      createdAt: existing.deck.createdAt,
      meta: { ...parsed.data.meta, source: existing.deck.meta.source },
      version: expectedVersion + 1,
      updatedAt: new Date().toISOString(),
    };
    // 乐观锁下推到写语句（CAS）：比较+写入原子化，消除应用层 TOCTOU 丢更新；同时写入归属（认领）。
    try {
      await saveDeck(deck, { expectedVersion, ownerId });
    } catch (e) {
      if (e instanceof VersionConflictError) {
        return NextResponse.json({ error: "课件已被更新，请刷新后重试" }, { status: 409 });
      }
      throw e;
    }
    return NextResponse.json({ id: deck.id, version: deck.version });
  } catch (e) {
    return errorResponse(e, "保存失败");
  }
}
