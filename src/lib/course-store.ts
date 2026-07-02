/**
 * 网页版课件（CourseDoc）存取。配置 DATABASE_URL 走 PostgreSQL，否则回退内存（本地/CI）。
 * 写一次读多次（生成后保存、按链接公开分享），无编辑/CAS 语义（Phase 1）。
 * 模式与 deck-store 一致：读路径复校验，不把库中 JSONB 盲转对外。
 */
import { randomBytes } from "node:crypto";
import { courseDocSchema, type CourseDoc } from "@/course/schema";
import { getPool, usePostgres } from "./db";

const mem = new Map<string, { doc: CourseDoc; ownerId: string | null }>();

export async function getCourse(id: string): Promise<CourseDoc | null> {
  if (usePostgres) {
    const { rows } = await getPool().query(`SELECT data FROM courses WHERE id = $1`, [id]);
    if (!rows[0]) return null;
    const parsed = courseDocSchema.safeParse(rows[0].data);
    if (!parsed.success) {
      console.error(`getCourse: 库中课件 ${id} 未通过 schema 校验`, parsed.error.issues);
      throw new Error(`课件数据格式已过期或损坏（id=${id}）`);
    }
    return parsed.data;
  }
  return mem.get(id)?.doc ?? null;
}

export async function saveCourse(
  doc: CourseDoc,
  opts: { ownerId?: string | null } = {},
): Promise<CourseDoc> {
  if (usePostgres) {
    await getPool().query(
      `INSERT INTO courses (id, title, data, owner_id, created_at)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [doc.id, doc.title, JSON.stringify(doc), opts.ownerId ?? null, doc.createdAt],
    );
    return doc;
  }
  if (!mem.has(doc.id)) mem.set(doc.id, { doc, ownerId: opts.ownerId ?? null });
  return doc;
}

export function newCourseId(): string {
  // CSPRNG：「链接即访问凭证」模型下，id 不可预测性等同于授权强度（与 deck id 同策略）。
  return `crs_${randomBytes(12).toString("base64url")}`;
}
