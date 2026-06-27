/**
 * 课件存取。配置 DATABASE_URL 时走 PostgreSQL（持久化），否则回退内存实现（本地/CI/无 DB）。
 * 接口收窄为 listDecks / getDeck / saveDeck，调用方无需感知后端。
 */
import type { Deck } from "@/schema/types";
import { fixtureDecks } from "@/schema/fixtures/decks";
import { getPool, usePostgres } from "./db";

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

// 内存回退：以 fixtures 作种子（仅无 DB 模式）。
const mem = new Map<string, Deck>(fixtureDecks.map((d) => [d.id, d]));

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

export async function listDecks(): Promise<DeckSummary[]> {
  if (usePostgres) {
    const { rows } = await getPool().query(
      `SELECT id, title, subject, grade_level, template_id, slide_count, source, updated_at
         FROM decks ORDER BY updated_at DESC LIMIT 200`,
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
  return [...mem.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(toSummary);
}

export async function getDeck(id: string): Promise<Deck | null> {
  if (usePostgres) {
    const { rows } = await getPool().query(`SELECT data FROM decks WHERE id = $1`, [id]);
    return rows[0] ? (rows[0].data as Deck) : null;
  }
  return mem.get(id) ?? null;
}

export async function saveDeck(deck: Deck): Promise<Deck> {
  if (usePostgres) {
    await getPool().query(
      `INSERT INTO decks (id, title, subject, grade_level, template_id, source, version, slide_count, data, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
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
      ],
    );
    return deck;
  }
  mem.set(deck.id, deck);
  return deck;
}

export function newDeckId(): string {
  return `deck_${Math.random().toString(36).slice(2, 10)}`;
}
