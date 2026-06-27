/**
 * M1 阶段的示例课件集合。生成（M2）与持久化（M5）就绪前，
 * 渲染层与播放器据此独立开发与验证。
 */
import type { Deck } from "../types";
import { sampleDeck } from "./sample-deck";

const historyDeck: Deck = {
  id: "deck_silk_road",
  version: 1,
  meta: {
    title: "丝绸之路",
    subject: "历史",
    gradeLevel: "junior",
    durationMinutes: 45,
    language: "zh-CN",
    objectives: ["了解丝绸之路的起止与路线", "理解其对东西方交流的意义"],
    source: "prompt",
  },
  templateId: "tpl-warm-coral",
  sections: [
    {
      id: "s1",
      title: "导入：一条改变世界的路",
      slides: [
        {
          id: "p1",
          layout: "title",
          pedagogyRole: "cover",
          speakerNotes: "用地图引出主题，约 1 分钟。",
          blocks: [
            { id: "h1", type: "heading", level: 1, text: "丝绸之路" },
            { id: "t1", type: "text", text: "横贯欧亚的古代商贸与文化通道", emphasis: true },
          ],
        },
        {
          id: "p2",
          layout: "single",
          pedagogyRole: "intro",
          blocks: [
            { id: "h2", type: "heading", level: 2, text: "它从哪里来，到哪里去？" },
            {
              id: "l1",
              type: "bulletList",
              items: ["起点：长安（今西安）", "终点：地中海沿岸", "全长七千余公里"],
            },
            {
              id: "poll1",
              type: "poll",
              prompt: "你认为丝绸之路最主要的作用是？",
              options: ["商品贸易", "文化交流", "宗教传播", "以上皆是"],
              runtime: { live: false },
            },
          ],
        },
      ],
    },
    {
      id: "s2",
      title: "讲解：交流了什么",
      slides: [
        {
          id: "p3",
          layout: "two-column",
          pedagogyRole: "explain",
          blocks: [
            { id: "h3", type: "heading", level: 2, text: "双向的交流" },
            { id: "t2", type: "text", text: "向西输出：丝绸、瓷器、造纸术。" },
            { id: "t3", type: "text", text: "向东传入：葡萄、汗血马、佛教。" },
            {
              id: "tb1",
              type: "table",
              headers: ["方向", "代表"],
              rows: [
                ["西出", "丝绸 / 瓷器 / 造纸"],
                ["东入", "葡萄 / 良马 / 佛教"],
              ],
            },
          ],
        },
        {
          id: "p4",
          layout: "centered",
          pedagogyRole: "summary",
          blocks: [
            { id: "h4", type: "heading", level: 2, text: "课堂小结" },
            {
              id: "tf1",
              type: "trueFalse",
              prompt: "判断：造纸术是经丝绸之路向西传播的。",
              answer: true,
              explanation: "造纸术由中国经丝绸之路西传，深刻影响了世界文明。",
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

export const fixtureDecks: Deck[] = [sampleDeck, historyDeck];
