/**
 * 课件存取（M1：内存 fixture 实现）。
 *
 * 这是一个有意收窄的接口：getDeck / listDecks。M5 接入 Prisma 时，
 * 仅替换此文件的实现（改为查库），调用方（路由、渲染层）无需改动。
 * 见 docs/02-architecture.md 的 persistence 模块边界。
 */
import type { Deck } from "@/schema/types";
import { fixtureDecks } from "@/schema/fixtures/decks";

export interface DeckSummary {
  id: string;
  title: string;
  subject?: string;
  gradeLevel?: string;
  templateId: string;
  slideCount: number;
}

export async function listDecks(): Promise<DeckSummary[]> {
  return fixtureDecks.map((d) => ({
    id: d.id,
    title: d.meta.title,
    subject: d.meta.subject,
    gradeLevel: d.meta.gradeLevel,
    templateId: d.templateId,
    slideCount: d.sections.reduce((n, s) => n + s.slides.length, 0),
  }));
}

export async function getDeck(id: string): Promise<Deck | null> {
  return fixtureDecks.find((d) => d.id === id) ?? null;
}

export async function listDeckIds(): Promise<string[]> {
  return fixtureDecks.map((d) => d.id);
}
