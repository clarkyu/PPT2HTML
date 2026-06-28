import { getAsset, getAssetUrl, useS3 } from "@/lib/asset-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 提供导入的图片资源：S3 模式重定向到签名 URL；否则从 DB/内存流式返回。 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!rateLimit(`asset:${clientIp(req)}`, 240, 60_000)) {
    return new Response("Too Many Requests", { status: 429 });
  }
  const { id } = await params;
  // base64url 字符集（与 newAssetId 一致）：A-Z a-z 0-9 - _
  if (!/^a_[A-Za-z0-9_-]+$/.test(id)) return new Response("Not found", { status: 404 });

  if (useS3) {
    const url = await getAssetUrl(id);
    if (!url) return new Response("Not found", { status: 404 });
    // 重定向到时效签名 URL；不缓存重定向本身（签名会过期）。
    return new Response(null, {
      status: 302,
      headers: { Location: url, "Cache-Control": "private, no-store" },
    });
  }

  const asset = await getAsset(id);
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(asset.data as BodyInit, {
    headers: {
      "Content-Type": asset.contentType,
      // 纵深防御：禁止 MIME 嗅探、作为附件内联展示，缓存随易失存储设为重校验。
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-cache",
    },
  });
}
