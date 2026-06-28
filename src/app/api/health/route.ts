import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 轻量存活探针（liveness）：证明 Node 进程已起并能响应 HTTP，供平台/反代/Uptime 探活。
 * 刻意不依赖 DB/外部服务——避免下游瞬时抖动触发不必要的实例重启（DB 故障另由应用层报错暴露）。
 * 返回 200 即「进程健康」。
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok", service: "yanke", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
