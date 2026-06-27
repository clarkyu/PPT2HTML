import { getAsset } from "@/lib/asset-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 提供导入的图片资源（内存存储，M5 前过渡）。 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = getAsset(id);
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(asset.data as BodyInit, {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
