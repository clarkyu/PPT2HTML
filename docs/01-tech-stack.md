# 01 · 技术栈选型

> 本文记录技术栈决策与理由。所有选型均为 **MVP 默认**，标注了可替换性，便于评审后调整。

## 选型总览

| 层 | 选型 | 理由 | 替代方案 |
| --- | --- | --- | --- |
| 前端框架 | **Next.js 15（App Router）+ React 19** | 一套代码覆盖多端；SSR/SSG/RSC 利于课件链接首屏与 SEO；API Routes/Server Actions 免拆后端，最适合 MVP 快速验证 | Vite + React SPA + 独立后端 |
| 语言 | **TypeScript（strict）** | 课件数据模型是核心，强类型贯穿生成、存储、渲染三端，避免结构漂移 | —— |
| 样式 | **Tailwind CSS + CSS 变量** | 工具类提速；模板换肤靠 CSS 变量在运行时切换，契合「换模板而内容不变」 | CSS Modules、vanilla-extract |
| UI 组件 | **shadcn/ui（Radix 基座）** | 可拥有源码、易定制、无障碍好；适合编辑器这类复杂交互 | Ant Design、MUI |
| 客户端状态 | **Zustand** | 编辑器/播放器本地状态轻量直观，避免 Redux 样板 | Jotai、Redux Toolkit |
| 服务端状态 | **TanStack Query** | 生成任务轮询、缓存、乐观更新（精修） | SWR |
| 数据库 | **PostgreSQL + Prisma** | 关系型存用户/课件元数据；课件正文以 **JSONB** 存（schema 灵活、可索引） | MySQL、MongoDB |
| 鉴权 | **Auth.js (NextAuth)** | 手机号登录为主锚点（对接未来统一 IdP，见 F15）；会话管理成熟 | 自建 JWT、Clerk |
| AI 接入 | **LLM Provider 抽象层** | 默认国产模型（DeepSeek / 通义千问 / 智谱 GLM），可切换 Claude/OpenAI；按任务分级路由 | 直连单一厂商 SDK |
| 结构化生成 | **JSON Schema + 校验（Zod / Ajv）** | 强制 LLM 产出贴合课件 Schema，结合 function-calling/JSON mode | —— |
| PWA | **Serwist（next 集成）** | Service Worker、离线缓存、预加载兜底，维护活跃 | next-pwa（停更风险） |
| 对象存储 | **S3 兼容（MinIO 本地 / 阿里云 OSS 生产）** | 图片、PPT 上传、PDF 导出 | 七牛、腾讯云 COS |
| PPT 解析 | **JSZip + fast-xml-parser 自研 OOXML 抽取** | .pptx 即 zip+XML，自研可控；图片走 media 目录 | 第三方 pptx 库（能力参差） |
| PDF 导出 | **Puppeteer（服务端渲染播放页→PDF）** | 复用渲染层，所见即所得 | 客户端 print、react-pdf |
| 实时（Phase 2） | **WebSocket（独立服务）+ Redis Pub/Sub** | 课堂会话、作答聚合、高并发；与主应用解耦 | Ably/Pusher 托管 |
| 测试 | **Vitest（单元）+ Playwright（E2E）** | Playwright 环境已预装，利于播放/多端回归 | Jest、Cypress |
| 包管理 | **npm（pnpm 可选）** | 环境默认 npm；如需更快可换 pnpm | pnpm、yarn |

## 关键决策说明

### 为什么 Next.js 全栈而非前后端分离

MVP 阶段的首要目标是 **快速验证生成闭环**，而非提前为规模化拆分服务。Next.js 全栈把页面、API、生成编排放在一个仓库与一次部署里，迭代最快。课件链接（F7）需要良好首屏与可分享性，RSC/SSG 是天然解。

**何时拆分**：进入 Phase 2 的实时互动子系统时，WebSocket 服务本就该独立部署（见架构文档）。届时主应用仍是 Next.js，只是把实时层剥离为独立服务——这是 PRD 第八章「独立且较重的子系统」的工程对应，不算返工。

### 为什么 LLM 用抽象层而非直连

这是一个面向中国 K12/教师的产品，**PIPL 与教育数据合规** 要求数据尽量不出境，国产模型在中文学科内容上也更强、成本更低。但早期原型阶段，海外模型（如 Claude）在复杂结构化生成上质量更稳。抽象层让我们：

1. 默认走国产模型，合规与成本可控；
2. 按任务分级路由——大纲等轻任务用快而省的模型，全文生成等重任务用更强模型；
3. 不被单一厂商绑定，可随模型能力演进切换。

抽象层接口见 [04-ai-pipeline.md](04-ai-pipeline.md)。

### 为什么课件正文存 JSONB 而非拆成多表

课件是一棵 **节 → 页 → 块** 的树，形态会随产品演进频繁变化（新增互动块类型等）。用 JSONB 整存一份课件文档，既保留查询能力（按 subject/grade 索引元数据列），又避免每次 schema 演进都改表结构。元数据（标题、学科、学段、模板、归属用户、时间戳）抽为独立列以便检索与权限。

## 环境与部署（建议）

- **本地开发**：Postgres + MinIO 以 docker-compose 起；`.env` 配置 LLM Key。
- **生产**：应用层可部署于支持 Node 的平台；数据库与对象存储用云服务；合规要求下选境内区域。
- **Node 版本**：≥ 20（当前环境 Node 22）。
