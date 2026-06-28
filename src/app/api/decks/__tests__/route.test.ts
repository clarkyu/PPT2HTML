/**
 * PUT /api/decks/[id] 访问控制路由测试（内存模式，CI 无需 DB）。
 * 覆盖 401（未登录）/403（他人课件）/认领（匿名课件）/id 校验/version 自增。
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Deck } from "@/schema/types";
import { fixtureDecks } from "@/schema/fixtures/decks";

// 必须在导入被测路由前 mock，使路由内的 auth 指向可控实现（避免加载真实 NextAuth）。
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { getDeckRecord, newDeckId, saveDeck } from "@/lib/deck-store";
import { PUT } from "../[id]/route";

const mockedAuth = vi.mocked(auth);

function makeDeck(id: string, overrides: Partial<Deck> = {}): Deck {
  return { ...structuredClone(fixtureDecks[0]), id, version: 1, ...overrides };
}

function putReq(id: string, body: unknown): Request {
  return new Request(`http://localhost/api/decks/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  mockedAuth.mockReset();
});

describe("PUT /api/decks/[id] 写保护", () => {
  it("未登录返回 401", async () => {
    const id = newDeckId();
    await saveDeck(makeDeck(id), { ownerId: null });
    mockedAuth.mockResolvedValue(null as never);
    const res = await PUT(putReq(id, makeDeck(id)), params(id));
    expect(res.status).toBe(401);
  });

  it("编辑他人课件返回 403", async () => {
    const id = newDeckId();
    await saveDeck(makeDeck(id), { ownerId: "u_owner" });
    mockedAuth.mockResolvedValue({ user: { id: "u_other" } } as never);
    const res = await PUT(putReq(id, makeDeck(id)), params(id));
    expect(res.status).toBe(403);
  });

  it("登录者认领匿名课件：200，owner 写入，version 自增", async () => {
    const id = newDeckId();
    await saveDeck(makeDeck(id, { version: 1 }), { ownerId: null });
    mockedAuth.mockResolvedValue({ user: { id: "u_me" } } as never);
    const res = await PUT(putReq(id, makeDeck(id, { version: 1 })), params(id));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { version: number };
    expect(json.version).toBe(2);
    const rec = await getDeckRecord(id);
    expect(rec?.ownerId).toBe("u_me");
  });

  it("owner 本人编辑：200", async () => {
    const id = newDeckId();
    await saveDeck(makeDeck(id, { version: 1 }), { ownerId: "u_me" });
    mockedAuth.mockResolvedValue({ user: { id: "u_me" } } as never);
    const res = await PUT(putReq(id, makeDeck(id, { version: 1 })), params(id));
    expect(res.status).toBe(200);
  });

  it("body.id 与路径 id 不一致返回 400", async () => {
    const id = newDeckId();
    await saveDeck(makeDeck(id), { ownerId: "u_me" });
    mockedAuth.mockResolvedValue({ user: { id: "u_me" } } as never);
    const res = await PUT(putReq(id, makeDeck("deck_mismatch")), params(id));
    expect(res.status).toBe(400);
  });

  it("不存在的课件返回 404", async () => {
    const id = newDeckId();
    mockedAuth.mockResolvedValue({ user: { id: "u_me" } } as never);
    const res = await PUT(putReq(id, makeDeck(id)), params(id));
    expect(res.status).toBe(404);
  });
});
