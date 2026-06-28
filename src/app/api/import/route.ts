import { NextResponse } from "next/server";
import { parsePptx } from "@/import/pptx";
import { mapPptxToDeck } from "@/import/map";
import { deckSchema } from "@/schema/zod";
import { newDeckId, saveDeck } from "@/lib/deck-store";
import { putAsset, useS3 } from "@/lib/asset-store";
import { deleteFromS3 } from "@/lib/s3";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { usePostgres, withTx } from "@/lib/db";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
// 单 deck 抽取出的图片字节总量上界（BYTEA 整存的过渡期保险）。
const MAX_ASSET_BYTES = 60 * 1024 * 1024;

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
    const { deck, assets } = mapPptxToDeck(parsed, {
      id: newDeckId(),
      now: new Date().toISOString(),
      templateId: "tpl-classic-blue",
      fallbackTitle,
    });

    const check = deckSchema.safeParse(deck);
    if (!check.success) {
      return errorResponse(check.error, "导入结果不合法");
    }
    // 资源体积兜底：避免单次大 PPT 把几十 MB 二进制写进库（BYTEA 过渡期，迁对象存储前的保险）。
    const assetBytes = assets.reduce((n, a) => n + a.data.byteLength, 0);
    if (assetBytes > MAX_ASSET_BYTES) {
      return NextResponse.json({ error: "课件内图片总量过大，请精简后重试" }, { status: 413 });
    }
    // 登录则归属导入者；匿名为 null（按链接公开）。
    const session = await auth();
    const ownerId = session?.user?.id ?? null;
    // 资源 + 课件写入。pg 用事务保证原子；S3 对象在事务外，写库失败时 best-effort 清理孤儿对象。
    try {
      if (usePostgres) {
        await withTx(async (c) => {
          for (const a of assets) await putAsset(a.id, a.data, a.contentType, c);
          await saveDeck(deck, { exec: c, ownerId });
        });
      } else {
        await Promise.all(assets.map((a) => putAsset(a.id, a.data, a.contentType)));
        await saveDeck(deck, { ownerId });
      }
    } catch (writeErr) {
      // S3 模式下图片已上传但落库失败 → 删除已上传对象，避免孤儿堆积（durable 方案另见 bucket 生命周期）。
      if (useS3) {
        await Promise.allSettled(assets.map((a) => deleteFromS3(a.id)));
      }
      throw writeErr;
    }
    return NextResponse.json({ id: deck.id, slides: parsed.slides.length });
  } catch (e) {
    return errorResponse(e, "导入失败");
  }
}
