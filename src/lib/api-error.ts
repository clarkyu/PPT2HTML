/**
 * 统一错误响应：真实异常只进服务端日志，对外只返回稳定文案 + 不透明 requestId，
 * 避免泄露 provider 名、上游状态码、Zod 内部细节等。
 */
import { NextResponse } from "next/server";

export function errorResponse(e: unknown, fallback: string, status = 500) {
  const requestId = crypto.randomUUID();
  console.error(`[api-error] ${requestId}`, e);
  return NextResponse.json({ error: fallback, requestId }, { status });
}
