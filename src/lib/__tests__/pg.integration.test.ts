/**
 * PostgreSQL 集成测试（仅在配置 DATABASE_URL 时运行；CI 的 postgres job 启用）。
 * 覆盖真实 SQL 路径：JSONB 往返、ON CONFLICT、CAS、排序/LIMIT、BYTEA 二进制往返。
 * 运行前需先 `npm run db:init` 应用迁移。
 */
import { afterAll, describe, expect, it } from "vitest";
import type { Deck } from "@/schema/types";
import { fixtureDecks } from "@/schema/fixtures/decks";
import { getDeck, listDecks, newDeckId, saveDeck, VersionConflictError } from "@/lib/deck-store";
import { getAsset, newAssetId, putAsset } from "@/lib/asset-store";
import { getPool } from "@/lib/db";

function makeDeck(id: string, overrides: Partial<Deck> = {}): Deck {
  return { ...structuredClone(fixtureDecks[0]), id, ...overrides };
}

const createdDecks: string[] = [];
const createdAssets: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)("PostgreSQL 持久化", () => {
  afterAll(async () => {
    const pool = getPool();
    if (createdDecks.length) {
      await pool.query("DELETE FROM decks WHERE id = ANY($1)", [createdDecks]);
    }
    if (createdAssets.length) {
      await pool.query("DELETE FROM assets WHERE id = ANY($1)", [createdAssets]);
    }
    await pool.end();
  });

  it("saveDeck → getDeck：JSONB 完整往返（含 sections 结构）", async () => {
    const id = newDeckId();
    createdDecks.push(id);
    const deck = makeDeck(id, { version: 1 });
    await saveDeck(deck);
    const got = await getDeck(id);
    expect(got).not.toBeNull();
    expect(got?.id).toBe(id);
    expect(got?.sections).toEqual(deck.sections);
  });

  it("同 id 再次 saveDeck 触发 ON CONFLICT DO UPDATE（不抛主键冲突）", async () => {
    const id = newDeckId();
    createdDecks.push(id);
    await saveDeck(makeDeck(id, { version: 1 }));
    const updated = makeDeck(id, {
      version: 2,
      meta: { ...fixtureDecks[0].meta, title: "更新后的标题" },
    });
    await saveDeck(updated);
    const got = await getDeck(id);
    expect(got?.meta.title).toBe("更新后的标题");
    expect(got?.version).toBe(2);
  });

  it("CAS：expectedVersion 不匹配抛 VersionConflictError，匹配则原子自增", async () => {
    const id = newDeckId();
    createdDecks.push(id);
    await saveDeck(makeDeck(id, { version: 5 }));
    await expect(
      saveDeck(makeDeck(id, { version: 6 }), { expectedVersion: 99 }),
    ).rejects.toBeInstanceOf(VersionConflictError);
    await expect(
      saveDeck(makeDeck(id, { version: 6 }), { expectedVersion: 5 }),
    ).resolves.toBeDefined();
    expect((await getDeck(id))?.version).toBe(6);
  });

  it("listDecks 按 updated_at DESC 排序且 ≤200", async () => {
    const id = newDeckId();
    createdDecks.push(id);
    await saveDeck(makeDeck(id, { version: 1, updatedAt: new Date().toISOString() }));
    const list = await listDecks();
    expect(list.length).toBeLessThanOrEqual(200);
    expect(list.some((d) => d.id === id)).toBe(true);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].updatedAt >= list[i].updatedAt).toBe(true);
    }
  });

  it("putAsset → getAsset：BYTEA 二进制原样往返（含 0x00），重复 put 不报错", async () => {
    const id = newAssetId();
    createdAssets.push(id);
    const bytes = new Uint8Array([0, 1, 2, 255, 0, 128, 0]);
    await putAsset(id, bytes, "image/png");
    await putAsset(id, new Uint8Array([9, 9]), "image/png"); // ON CONFLICT DO NOTHING：保留首份
    const got = await getAsset(id);
    expect(got).not.toBeNull();
    expect(got?.contentType).toBe("image/png");
    expect(got?.data.byteLength).toBe(bytes.byteLength);
    expect(Array.from(got!.data)).toEqual(Array.from(bytes));
  });
});
