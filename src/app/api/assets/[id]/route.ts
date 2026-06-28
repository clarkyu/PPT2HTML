import { getAsset } from "@/lib/asset-store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 提供导入的图片资源（内存存储，M5 前过渡）。 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!rateLimit(`asset:${clientIp(req)}`, 240, 60_000)) {
    return new Response("Too Many Requests", { status: 429 });
  }
  const { id } = await params;
  // base64url 字符集（与 newAssetId 一致）：A-Z a-z 0-9 - _
  if (!/^a_[A-Za-z0-9_-]+$/.test(id)) return new Response("Not found", { status: 404 });
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
