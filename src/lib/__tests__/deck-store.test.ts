/**
 * 内存回退模式的 store 契约测试（仅在未配置 DATABASE_URL 时运行）。
 * 固定跨后端不变的行为：往返、CAS 乐观锁、归属过滤/认领、稳定排序、id 生成。
 */
import { describe, expect, it } from "vitest";
import type { Deck } from "@/schema/types";
import { fixtureDecks } from "@/schema/fixtures/decks";
import {
  getDeck,
  getDeckRecord,
  listDecks,
  newDeckId,
  saveDeck,
  VersionConflictError,
} from "@/lib/deck-store";

function makeDeck(id: string, overrides: Partial<Deck> = {}): Deck {
  return { ...structuredClone(fixtureDecks[0]), id, ...overrides };
}

describe.skipIf(Boolean(process.env.DATABASE_URL))("deck-store（内存模式契约）", () => {
  it("newDeckId 生成带前缀且互不相同的 id", () => {
    const a = newDeckId();
    const b = newDeckId();
    expect(a).toMatch(/^deck_[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(b);
  });

  it("saveDeck → getDeck 往返一致", async () => {
    const id = newDeckId();
    const deck = makeDeck(id, { version: 1 });
    await saveDeck(deck, { ownerId: "u_a" });
    const got = await getDeck(id);
    expect(got?.id).toBe(id);
    expect(got?.meta.title).toBe(deck.meta.title);
    expect(got?.sections.length).toBe(deck.sections.length);
  });

  it("listDecks 仅返回该用户拥有的课件，summary 正确", async () => {
    const idA = newDeckId();
    const idB = newDeckId();
    await saveDeck(makeDeck(idA, { version: 1 }), { ownerId: "u_owner1" });
    await saveDeck(makeDeck(idB, { version: 1 }), { ownerId: "u_owner2" });
    const mine = await listDecks("u_owner1");
    expect(mine.some((d) => d.id === idA)).toBe(true);
    expect(mine.some((d) => d.id === idB)).toBe(false);
    const summary = mine.find((d) => d.id === idA)!;
    const slideCount = fixtureDecks[0].sections.reduce((n, s) => n + s.slides.length, 0);
    expect(summary.slideCount).toBe(slideCount);
    expect(summary.source).toBe(fixtureDecks[0].meta.source);
  });

  it("listDecks 按 updatedAt 降序、相同则 id 降序（稳定）", async () => {
    const ts = "2030-01-01T00:00:00.000Z";
    await saveDeck(makeDeck("deck_zzz_sort", { version: 1, updatedAt: ts }), { ownerId: "u_sort" });
    await saveDeck(makeDeck("deck_aaa_sort", { version: 1, updatedAt: ts }), { ownerId: "u_sort" });
    const ids = (await listDecks("u_sort")).map((d) => d.id);
    expect(ids.indexOf("deck_zzz_sort")).toBeLessThan(ids.indexOf("deck_aaa_sort"));
  });

  it("CAS：expectedVersion 不匹配抛 VersionConflictError，匹配则写入", async () => {
    const id = newDeckId();
    await saveDeck(makeDeck(id, { version: 3 }), { ownerId: "u_cas" });
    await expect(
      saveDeck(makeDeck(id, { version: 4 }), { expectedVersion: 2 }),
    ).rejects.toBeInstanceOf(VersionConflictError);
    await expect(
      saveDeck(makeDeck(id, { version: 4 }), { expectedVersion: 3 }),
    ).resolves.toBeDefined();
    expect((await getDeck(id))?.version).toBe(4);
  });

  it("归属：匿名课件可被登录者认领，owner 保留至后续保存", async () => {
    const id = newDeckId();
    await saveDeck(makeDeck(id, { version: 1 }), { ownerId: null }); // 匿名创建
    expect((await getDeckRecord(id))?.ownerId).toBeNull();
    // 认领：CAS 写入 ownerId
    await saveDeck(makeDeck(id, { version: 2 }), { expectedVersion: 1, ownerId: "u_claim" });
    expect((await getDeckRecord(id))?.ownerId).toBe("u_claim");
    // 不传 ownerId 的后续 CAS 保留归属
    await saveDeck(makeDeck(id, { version: 3 }), { expectedVersion: 2 });
    expect((await getDeckRecord(id))?.ownerId).toBe("u_claim");
  });
});
