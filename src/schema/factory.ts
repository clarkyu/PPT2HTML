/**
 * Deck 构造辅助。块 id 在创作/生成时生成；时间戳由调用方传入或在持久层补。
 */
import type { Deck, DeckMeta } from "./types";

let counter = 0;

/** 生成块/节/页的稳定 id（精修按 id 定位，见 docs/03-data-model.md）。 */
export function createBlockId(prefix = "b"): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export interface CreateDeckInput {
  id: string;
  meta: DeckMeta;
  templateId: string;
  now: string; // ISO 时间戳由调用方提供（保持函数纯净、可测试）
}

export function createDeck(input: CreateDeckInput): Deck {
  return {
    id: input.id,
    version: 1,
    meta: input.meta,
    templateId: input.templateId,
    sections: [],
    createdAt: input.now,
    updatedAt: input.now,
  };
}
