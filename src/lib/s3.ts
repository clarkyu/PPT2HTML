/**
 * S3 兼容对象存储（资源图片）。配置 S3_BUCKET 时启用：图片字节存对象存储、DB 不再存 BYTEA，
 * /api/assets 重定向到时效签名 URL（卸载应用带宽 + 备份不被图片体积绑架）。
 * AWS SDK 惰性按需加载——未启用 S3 的部署不加载该依赖。
 */
type S3ClientLike = import("@aws-sdk/client-s3").S3Client;

/** 是否启用对象存储（由 S3_BUCKET 决定）。 */
export const useS3 = Boolean(process.env.S3_BUCKET);

const BUCKET = process.env.S3_BUCKET ?? "";
const PREFIX = process.env.S3_PREFIX ?? "assets/";
const URL_TTL = Number(process.env.S3_URL_TTL ?? 300);

function envBool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  const s = v.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return undefined;
}

/** 解析是否启用 path-style：显式 S3_FORCE_PATH_STYLE 优先，否则自定义 endpoint 默认启用。 */
export function resolveForcePathStyle(force: string | undefined, endpoint: string | undefined): boolean {
  const b = envBool(force);
  return b !== undefined ? b : Boolean(endpoint);
}

const g = globalThis as unknown as { __s3?: Promise<S3ClientLike> };

function key(id: string): string {
  return `${PREFIX}${id}`;
}

// 启动期一次性日志（对齐 db.ts 可观测性）：明确模式与凭据来源，避免静默回落默认凭据链不可知。
if (useS3) {
  const hasCreds = Boolean(process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
  console.info(
    `[s3] 对象存储已启用：bucket=${BUCKET}` +
      (process.env.S3_ENDPOINT ? `, endpoint=${process.env.S3_ENDPOINT}` : "") +
      (hasCreds ? "" : "（未配显式凭据，将走默认凭据链/IAM 角色）"),
  );
}

function client(): Promise<S3ClientLike> {
  if (!g.__s3) {
    g.__s3 = (async () => {
      const { S3Client } = await import("@aws-sdk/client-s3");
      const accessKeyId = process.env.S3_ACCESS_KEY;
      const secretAccessKey = process.env.S3_SECRET_KEY;
      return new S3Client({
        region: process.env.S3_REGION ?? "us-east-1",
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: resolveForcePathStyle(process.env.S3_FORCE_PATH_STYLE, process.env.S3_ENDPOINT),
        credentials:
          accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
      });
    })();
  }
  return g.__s3;
}

export async function putToS3(id: string, data: Uint8Array, contentType: string): Promise<void> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await (await client()).send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key(id),
      Body: data,
      ContentType: contentType,
      ContentDisposition: "inline",
    }),
  );
}

/** 删除对象（导入失败的孤儿清理用，best-effort）。 */
export async function deleteFromS3(id: string): Promise<void> {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await (await client()).send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key(id) }));
}

/** 资源存在则返回时效签名 GET URL，否则 null（供 /api/assets 重定向）。 */
export async function presignGet(id: string): Promise<string | null> {
  const { GetObjectCommand, HeadObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const c = await client();
  let head;
  try {
    head = await c.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key(id) }));
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    const status = e.$metadata?.httpStatusCode;
    // 仅「确实不存在」吞为 null→404；配置/权限/网络错误记录并上抛，让路由转 5xx，可观测。
    if (status === 404 || e.name === "NotFound" || e.name === "NoSuchKey") return null;
    console.error("[s3] presignGet HeadObject 失败", { name: e.name, status, bucket: BUCKET });
    throw err;
  }
  // 随签名锁定响应类型/呈现/缓存：重定向后浏览器直连 S3，原路由安全头不再生效，故在此钉死。
  return getSignedUrl(
    c,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key(id),
      ResponseContentType: head.ContentType, // 导入时已白名单为 image/*
      ResponseContentDisposition: "inline",
      ResponseCacheControl: "private, no-store",
    }),
    { expiresIn: URL_TTL },
  );
}
