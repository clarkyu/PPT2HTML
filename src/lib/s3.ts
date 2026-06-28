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

const g = globalThis as unknown as { __s3?: Promise<S3ClientLike> };

function key(id: string): string {
  return `${PREFIX}${id}`;
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
        // 自定义 endpoint（MinIO / 兼容服务）通常需 path-style；可用 S3_FORCE_PATH_STYLE=0/1 覆盖。
        forcePathStyle:
          process.env.S3_FORCE_PATH_STYLE === "1" ||
          (process.env.S3_FORCE_PATH_STYLE !== "0" && Boolean(process.env.S3_ENDPOINT)),
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
    new PutObjectCommand({ Bucket: BUCKET, Key: key(id), Body: data, ContentType: contentType }),
  );
}

/** 资源存在则返回时效签名 GET URL，否则 null（供 /api/assets 重定向）。 */
export async function presignGet(id: string): Promise<string | null> {
  const { GetObjectCommand, HeadObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const c = await client();
  try {
    await c.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key(id) }));
  } catch {
    return null; // 不存在或不可达 → 让上层 404
  }
  return getSignedUrl(c, new GetObjectCommand({ Bucket: BUCKET, Key: key(id) }), {
    expiresIn: URL_TTL,
  });
}
