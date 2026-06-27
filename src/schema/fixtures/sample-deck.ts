/**
 * 示例课件：用于验证渲染层（M1）在「生成」就绪前即可独立开发。
 * 这份 Deck 应能通过 deckSchema 校验，并被渲染层正确呈现。
 */
import type { Deck } from "../types";

export const sampleDeck: Deck = {
  id: "deck_sample",
  version: 1,
  meta: {
    title: "光合作用",
    subject: "生物",
    gradeLevel: "junior",
    durationMinutes: 40,
    language: "zh-CN",
    objectives: ["理解光合作用的原料与产物", "能描述光合作用的基本过程"],
    source: "prompt",
  },
  templateId: "tpl-academic-green",
  sections: [
    {
      id: "sec_1",
      title: "导入：植物如何「吃饭」？",
      slides: [
        {
          id: "sld_1",
          layout: "media-right",
          pedagogyRole: "intro",
          speakerNotes: "用提问引发好奇，约 2 分钟。",
          blocks: [
            { id: "b1", type: "heading", level: 1, text: "植物如何获得能量？" },
            {
              id: "b2",
              type: "bulletList",
              items: ["动物靠进食获取能量", "植物靠什么？", "今天我们揭晓答案"],
            },
            {
              id: "b3",
              type: "poll",
              prompt: "你认为植物的「食物」主要来自？",
              options: ["土壤", "空气与阳光", "水", "肥料"],
              runtime: { live: false },
            },
          ],
        },
      ],
    },
    {
      id: "sec_2",
      title: "讲解：光合作用的过程",
      slides: [
        {
          id: "sld_2",
          layout: "single",
          pedagogyRole: "explain",
          blocks: [
            { id: "b4", type: "heading", level: 2, text: "光合作用的总反应" },
            {
              id: "b5",
              type: "formula",
              latex:
                "6CO_2 + 6H_2O \\xrightarrow{\\text{光照, 叶绿体}} C_6H_{12}O_6 + 6O_2",
            },
            {
              id: "b6",
              type: "text",
              text: "在光照下，叶绿体把二氧化碳和水转化为有机物（葡萄糖）并释放氧气。",
            },
          ],
        },
        {
          id: "sld_3",
          layout: "centered",
          pedagogyRole: "summary",
          blocks: [
            { id: "b7", type: "heading", level: 2, text: "课堂小结" },
            {
              id: "b8",
              type: "mcq",
              prompt: "光合作用释放的气体是？",
              options: ["二氧化碳", "氧气", "氮气", "氢气"],
              answerIndex: 1,
              explanation: "光合作用消耗 CO₂，释放 O₂。",
              runtime: { live: false },
            },
          ],
        },
      ],
    },
  ],
  createdAt: "2026-06-27T00:00:00.000Z",
  updatedAt: "2026-06-27T00:00:00.000Z",
};
