/**
 * 课件存取（M1 读 + M2 写，内存实现）。
 *
 * 这是一个有意收窄的接口：listDecks / getDeck / saveDeck。M5 接入 Prisma 时仅替换此文件
 * 的实现（改为查/写库），调用方（路由、渲染层、生成流水线）无需改动。
 *
 * 注意：内存存储仅在单进程（next dev / next start）内有效，进程重启即丢失，
 * 多实例部署下不共享——这是 M5 之前的过渡实现。
 */
import type { Deck } from "@/schema/types";
import { fixtureDecks } from "@/schema/fixtures/decks";

const store = new Map<string, Deck>(fixtureDecks.map((d) => [d.id, d]));

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

function toSummary(d: Deck): DeckSummary {
  return {
    id: d.id,
    title: d.meta.title,
    subject: d.meta.subject,
    gradeLevel: d.meta.gradeLevel,
    templateId: d.templateId,
    slideCount: d.sections.reduce((n, s) => n + s.slides.length, 0),
    source: d.meta.source,
    updatedAt: d.updatedAt,
  };
}

export async function listDecks(): Promise<DeckSummary[]> {
  return [...store.values()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toSummary);
}

export async function getDeck(id: string): Promise<Deck | null> {
  return store.get(id) ?? null;
}

export async function saveDeck(deck: Deck): Promise<Deck> {
  store.set(deck.id, deck);
  return deck;
}

/** 仅返回 fixtures 的 id 供 generateStaticParams 预渲染；运行时生成的课件走动态渲染。 */
export async function listDeckIds(): Promise<string[]> {
  return fixtureDecks.map((d) => d.id);
}

export function newDeckId(): string {
  return `deck_${Math.random().toString(36).slice(2, 10)}`;
}
