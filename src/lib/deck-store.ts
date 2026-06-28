/**
 * 课件存取。配置 DATABASE_URL 时走 PostgreSQL（持久化），否则回退内存实现（本地/CI/无 DB）。
 * 接口收窄为 listDecks / getDeck / getDeckRecord / saveDeck，调用方无需感知后端。
 * 归属（M5-2）：owner_id 记录创建者；匿名创建为 null（按链接公开）。
 */
import { randomBytes } from "node:crypto";
import type { Deck } from "@/schema/types";
import { deckSchema } from "@/schema/zod";
import { fixtureDecks } from "@/schema/fixtures/decks";
import { getPool, usePostgres, type Executor } from "./db";

export interface DeckSummary {
  id: string;
  title: string;
  subject?: string;
  gradeLevel?: string;
  templateId: string;
  slideCount: number;
  source: Deck["meta"]["source"];
  updatedAt: string;
}

/** 含归属信息的内部记录（供写保护判定）。 */
export interface DeckRecord {
  deck: Deck;
  ownerId: string | null;
}

/** 乐观锁冲突：客户端 version 与库中当前不一致（并发编辑）。 */
export class VersionConflictError extends Error {
  constructor() {
    super("version conflict");
    this.name = "VersionConflictError";
  }
}

// 内存回退：以 fixtures 作种子（归属 null = 公开演示），给零配置 dev/演示提供示例课件。
// 注意：这是「内存=自带演示内容」的有意行为，Postgres 模式则为干净持久化、首启为空。
const mem = new Map<string, DeckRecord>(
  fixtureDecks.map((d) => [d.id, { deck: d, ownerId: null }]),
);

function slideCountOf(d: Deck): number {
  return d.sections.reduce((n, s) => n + s.slides.length, 0);
}

function toSummary(d: Deck): DeckSummary {
  return {
    id: d.id,
    title: d.meta.title,
    subject: d.meta.subject,
    gradeLevel: d.meta.gradeLevel,
    templateId: d.templateId,
    slideCount: slideCountOf(d),
    source: d.meta.source,
    updatedAt: d.updatedAt,
  };
}

/** 列出某用户拥有的课件（「我的课件」）。 */
export async function listDecks(ownerId: string): Promise<DeckSummary[]> {
  if (usePostgres) {
    const { rows } = await getPool().query(
      `SELECT id, title, subject, grade_level, template_id, slide_count, source, updated_at
         FROM decks WHERE owner_id = $1 ORDER BY updated_at DESC, id DESC LIMIT 200`,
      [ownerId],
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      subject: r.subject ?? undefined,
      gradeLevel: r.grade_level ?? undefined,
      templateId: r.template_id,
      slideCount: r.slide_count,
      source: r.source,
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  }
  // 次级键以 id 兜底，确保相同 updatedAt 时顺序稳定且与 Postgres 一致。
  return [...mem.values()]
    .filter((r) => r.ownerId === ownerId)
    .map((r) => r.deck)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))
    .map(toSummary);
}

/** 读取含归属的记录（供写保护/认领判定）。 */
export async function getDeckRecord(id: string): Promise<DeckRecord | null> {
  if (usePostgres) {
    const { rows } = await getPool().query(`SELECT data, owner_id FROM decks WHERE id = $1`, [id]);
    if (!rows[0]) return null;
    // 读路径复校验：不把库中 JSONB 盲转为 Deck 直接对外（纵深防御 + 损坏/过期数据告警）。
    const parsed = deckSchema.safeParse(rows[0].data);
    if (!parsed.success) {
      console.error(`getDeck: 库中课件 ${id} 未通过 schema 校验`, parsed.error.issues);
      throw new Error(`课件数据格式已过期或损坏（id=${id}）`);
    }
    return { deck: parsed.data as Deck, ownerId: rows[0].owner_id ?? null };
  }
  return mem.get(id) ?? null;
}

export async function getDeck(id: string): Promise<Deck | null> {
  return (await getDeckRecord(id))?.deck ?? null;
}

/**
 * 保存课件。
 * - 不传 expectedVersion：新建/导入（INSERT；冲突时更新但保留 owner_id）。owner_id = opts.ownerId ?? null。
 * - 传 expectedVersion：CAS 语义——仅当库中 version 等于 expectedVersion 时写入，否则抛 VersionConflictError。
 *   传 ownerId 时一并写入 owner_id（支持登录用户认领此前匿名的课件）。
 * - exec：可选执行器（事务中传 PoolClient 复用同一连接）。
 */
export async function saveDeck(
  deck: Deck,
  opts: { expectedVersion?: number; exec?: Executor; ownerId?: string | null } = {},
): Promise<Deck> {
  const { expectedVersion } = opts;
  if (usePostgres) {
    const exec = opts.exec ?? getPool();
    if (expectedVersion !== undefined) {
      // 原子比较+写：WHERE version=expected 命中 0 行即并发冲突（或已不存在）。
      // 更新不改 created_at，故单列参数表；owner_id 仅在显式传入时写（认领）。
      const setOwner = opts.ownerId !== undefined;
      const params: unknown[] = [
        deck.id,
        deck.meta.title,
        deck.meta.subject ?? null,
        deck.meta.gradeLevel ?? null,
        deck.templateId,
        deck.meta.source,
        deck.version,
        slideCountOf(deck),
        JSON.stringify(deck),
        deck.updatedAt,
        expectedVersion,
      ];
      if (setOwner) params.push(opts.ownerId ?? null);
      const { rowCount } = await exec.query(
        `UPDATE decks SET
           title=$2, subject=$3, grade_level=$4, template_id=$5, source=$6,
           version=$7, slide_count=$8, data=$9::jsonb, updated_at=$10${setOwner ? ", owner_id=$12" : ""}
         WHERE id=$1 AND version=$11`,
        params,
      );
      if (rowCount === 0) throw new VersionConflictError();
      return deck;
    }
    await exec.query(
      `INSERT INTO decks (id, title, subject, grade_level, template_id, source, version, slide_count, data, created_at, updated_at, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         title=$2, subject=$3, grade_level=$4, template_id=$5, source=$6,
         version=$7, slide_count=$8, data=$9::jsonb, updated_at=$11`,
      [
        deck.id,
        deck.meta.title,
        deck.meta.subject ?? null,
        deck.meta.gradeLevel ?? null,
        deck.templateId,
        deck.meta.source,
        deck.version,
        slideCountOf(deck),
        JSON.stringify(deck),
        deck.createdAt,
        deck.updatedAt,
        opts.ownerId ?? null,
      ],
    );
    return deck;
  }
  // 内存回退：复刻相同的 CAS / 归属语义，保证两后端行为一致。
  const prev = mem.get(deck.id);
  if (expectedVersion !== undefined) {
    if (!prev || prev.deck.version !== expectedVersion) throw new VersionConflictError();
    const ownerId = opts.ownerId !== undefined ? opts.ownerId : prev.ownerId;
    mem.set(deck.id, { deck, ownerId });
    return deck;
  }
  // INSERT 语义：新建取 opts.ownerId，已存在则保留原 owner（与 PG 的 ON CONFLICT 一致）。
  const ownerId = prev ? prev.ownerId : opts.ownerId ?? null;
  mem.set(deck.id, { deck, ownerId });
  return deck;
}

export function newDeckId(): string {
  // CSPRNG：在「链接即访问凭证」模型下，id 不可预测性等同于授权强度。
  return `deck_${randomBytes(12).toString("base64url")}`;
}
