/**
 * S3 配置解析单测（纯函数，不加载 AWS SDK）。
 */
import { describe, expect, it } from "vitest";
import { resolveForcePathStyle } from "@/lib/s3";

describe("S3 forcePathStyle 解析", () => {
  it("显式真值/假值优先（容忍 true/yes/on、false/no/off）", () => {
    expect(resolveForcePathStyle("1", undefined)).toBe(true);
    expect(resolveForcePathStyle("true", undefined)).toBe(true);
    expect(resolveForcePathStyle("YES", "http://x")).toBe(true);
    expect(resolveForcePathStyle("0", "http://x")).toBe(false);
    expect(resolveForcePathStyle("false", "http://x")).toBe(false);
    expect(resolveForcePathStyle("off", undefined)).toBe(false);
  });

  it("未设置/无法识别时按是否有自定义 endpoint 回退", () => {
    expect(resolveForcePathStyle(undefined, "http://minio:9000")).toBe(true);
    expect(resolveForcePathStyle(undefined, undefined)).toBe(false);
    expect(resolveForcePathStyle("garbage", "http://x")).toBe(true);
    expect(resolveForcePathStyle("garbage", undefined)).toBe(false);
  });
});
