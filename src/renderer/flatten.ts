/** 把「节 → 页」的树压平为线性播放序列（播放器与概览共用）。 */
import type { Deck, Slide } from "@/schema/types";

export interface FlatSlide {
  slide: Slide;
  sectionId: string;
  sectionTitle: string;
  index: number;
}

export function flattenSlides(deck: Deck): FlatSlide[] {
  const out: FlatSlide[] = [];
  for (const section of deck.sections) {
    for (const slide of section.slides) {
      out.push({
        slide,
        sectionId: section.id,
        sectionTitle: section.title,
        index: out.length,
      });
    }
  }
  return out;
}
