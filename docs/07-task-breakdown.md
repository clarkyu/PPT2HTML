# 07 · MVP 工程任务拆解（Epic → Story）

> 按 06-roadmap 的里程碑展开为可领取的工程任务。每个 Story 标注关联功能编号与里程碑。
> 这是进入编码阶段后的工作清单来源。

## Epic A · 数据模型与领域核心（M0）
- [ ] A1 定义课件 Schema 的 TypeScript 类型（`src/schema/types.ts`）
- [ ] A2 用 Zod 实现运行时校验，与类型同源（`src/schema/zod.ts`）
- [ ] A3 Zod → JSON Schema 转换，供 LLM 结构化生成约束
- [ ] A4 Deck 工厂/构造辅助 + 块 id 生成器
- [ ] A5 Schema 单元测试 + 一份手写示例 Deck（fixture）
- [ ] A6 未知块类型的降级策略与 `version` 迁移钩子

## Epic B · 项目脚手架与基础设施（M0）
- [ ] B1 Next.js 15 + TS + Tailwind + shadcn/ui 初始化
- [ ] B2 Prisma + PostgreSQL 接入，Deck/User model（正文存 JSONB）
- [ ] B3 对象存储（S3/MinIO）封装：上传/取 URL
- [ ] B4 LLM Provider 抽象层 + 国产模型默认适配 + 配置化路由表
- [ ] B5 `.env.example`、配置加载与校验
- [ ] B6 docker-compose（Postgres + MinIO）本地开发环境
- [ ] B7 ESLint/Prettier、Vitest、Playwright 基线 + CI

## Epic C · 渲染层与播放（M1）
- [ ] C1 块渲染器：每种 ContentBlock 一个 React 组件
- [ ] C2 互动块的静态呈现组件（poll/mcq/quiz…，MVP 不联网）
- [ ] C3 布局引擎：`layout` → 各端栅格映射（手机单列 / 大屏多栏）
- [ ] C4 主题应用：`templateId`+`theme` → CSS 变量注入
- [ ] C5 全屏播放器：翻页（键鼠/触控/手势）、进度
- [ ] C6 演讲者备注与计时（F9）
- [ ] C7 课件路由 `/deck/[id]`（详情）与 `/deck/[id]/play`（播放，F7）
- [ ] C8 多端自适应回归（Playwright 多视口）

## Epic D · 生成闭环（M2）
- [ ] D1 意图解析 Agent + Prompt（F2）
- [ ] D2 要素卡片 UI：展示「识别到/我补的」，可一键改（F2）
- [ ] D3 教学设计 Agent + Prompt，产出大纲（F3）
- [ ] D4 大纲编辑 UI：增删改、拖拽调序（F3）
- [ ] D5 内容生成 Agent + Prompt，流式逐节返回（F4）
- [ ] D6 生成进度与渐进式渲染前端
- [ ] D7 校验 Agent + 修复重试
- [ ] D8 生成编排 API：intent / outline / content / 任务状态
- [ ] D9 创作入口 UI（一句话输入 + 可选约束，F1）

## Epic E · 模板与精修（M3）
- [ ] E1 模板注册表 + ≥3 套专业模板（CSS 变量 + 栅格规则）
- [ ] E2 模板选择与一键切换实时预览（F5）
- [ ] E3 基础自定义面板：配色/字体/版式/校徽（F5）
- [ ] E4 精修 Agent：定位受影响块、局部重写（F8）
- [ ] E5 对话式精修 UI（自然语言指令）
- [ ] E6 直接编辑：文字编辑、元素替换（F8）

## Epic F · PPT 导入（M4，可与 D/E 并行）
- [ ] F1 .pptx 上传 UI + 服务端接收
- [ ] F2 OOXML 解析：JSZip 解包 + 抽取 slide 文本/图片/结构
- [ ] F3 图片资源转存对象存储
- [ ] F4 映射器：slide→Slide、shape→Block、套模板
- [ ] F5 失败兜底与降级提示（复杂版式/异常文件）
- [ ] F6 导入产物落库，进入与生成产物同一编辑/播放流

## Epic G · 账户与作品管理（M5）
- [ ] G1 Auth.js 接入，手机号为主锚点，预留 IdP 接口（F15）
- [ ] G2 注册/登录 UI 与会话
- [ ] G3 个人作品空间：列表、命名、检索、删除（F14）
- [ ] G4 课件自动保存与版本（`Deck.version`）
- [ ] G5 再次编辑与继续授课入口

## Epic H · PWA 与导出（M5）
- [ ] H1 Serwist 接入，manifest + Service Worker，添加主屏（F13）
- [ ] H2 已生成课件离线打开（缓存 Deck JSON + 资源）
- [ ] H3 授课预加载兜底（F13）
- [ ] H4 PDF 导出：Puppeteer 渲染播放页 → PDF（F14）

## Epic I · 质量与合规（横切，贯穿全程）
- [ ] I1 内容安全：校验 Agent 自检规则 + 前端准确性提示
- [ ] I2 PIPL/教育数据合规：默认境内存储、数据分区弹性预留
- [ ] I3 配图版权来源规范
- [ ] I4 性能：大纲秒级、全文 1–2 分钟、精修近实时的监测埋点
- [ ] I5 北极星指标埋点：周内真实授课课件数等（成功指标）

## 建议的推进顺序（关键路径）

```
B(脚手架) → A(数据模型) → C(渲染播放) → D(生成闭环) → E(模板精修) → G/H(收口)
                                    └─ F(PPT导入，并行) ─┘
I(质量合规) 全程横切
```

> 先把「渲染播放」做在「生成」之前：有了确定性的呈现，才能验证 AI 产出的好坏；
> 也让 PPT 导入（F）能尽早复用渲染层并行开工。
