import { NextResponse } from "next/server";
import { parsePptx } from "@/import/pptx";
import { mapPptxToDeck } from "@/import/map";
import { deckSchema } from "@/schema/zod";
import { newDeckId, saveDeck } from "@/lib/deck-store";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  if (!rateLimit(`import:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  // 快速闸：超大请求体在缓冲进内存前直接拒（Content-Length 可缺失/伪造，仅作早拒，不替代后续校验）。
  const contentLength = Number(req.headers.get("content-length"));
  if (contentLength && contentLength > MAX_FILE_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "文件过大（上限 25MB）" }, { status: 413 });
  }
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择要导入的 .pptx 文件" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pptx")) {
      return NextResponse.json({ error: "仅支持 .pptx 文件" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "文件过大（上限 25MB）" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // 解析阶段失败给用户可读提示（消息为内部 curated 文案，安全可见）。
    let parsed;
    try {
      parsed = await parsePptx(bytes);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "解析失败" },
        { status: 400 },
      );
    }

    const fallbackTitle = file.name.replace(/\.pptx$/i, "") || "导入的课件";
    const deck = mapPptxToDeck(parsed, {
      id: newDeckId(),
      now: new Date().toISOString(),
      templateId: "tpl-classic-blue",
      fallbackTitle,
    });

    const check = deckSchema.safeParse(deck);
    if (!check.success) {
      return errorResponse(check.error, "导入结果不合法");
    }
    await saveDeck(deck);
    return NextResponse.json({ id: deck.id, slides: parsed.slides.length });
  } catch (e) {
    return errorResponse(e, "导入失败");
  }
}
