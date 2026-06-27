# 言课（YanKe）· 智能课件平台

> **老师只负责提升想法，实现交给言课。**

言课是一款 **手机优先、多端自适应的 PWA**，也是一座 **AI 原生的智能课堂**。
老师只需说一句话，或导入一份旧 PPT，系统即生成一份内容详实、逻辑清晰、风格可选、
原生可互动的「网页版课件」，并在任意设备的浏览器中直接全屏开讲——课件本身就是一个链接。

本仓库当前处于 **规划与脚手架阶段**。完整产品需求见 [`docs/PRD-v0.3.md`](docs/PRD-v0.3.md)。

---

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [docs/PRD-v0.3.md](docs/PRD-v0.3.md) | 产品需求文档（第三版，权威来源） |
| [docs/01-tech-stack.md](docs/01-tech-stack.md) | 技术栈选型与理由 |
| [docs/02-architecture.md](docs/02-architecture.md) | 系统架构与分层 |
| [docs/03-data-model.md](docs/03-data-model.md) | 课件结构化数据模型（核心架构赌注） |
| [docs/04-ai-pipeline.md](docs/04-ai-pipeline.md) | AI 多 Agent 生成流水线 |
| [docs/05-mvp-scope.md](docs/05-mvp-scope.md) | MVP 范围与 F1–F15 功能映射 |
| [docs/06-roadmap.md](docs/06-roadmap.md) | 分阶段路线图 |
| [docs/07-task-breakdown.md](docs/07-task-breakdown.md) | MVP 工程任务拆解（Epic → Story） |
| [docs/08-open-questions.md](docs/08-open-questions.md) | 待确认决策与默认假设 |

---

## 核心设计原则（一句话版）

1. **极简输入，智能补全** —— 入口只是一句话或一份旧 PPT。
2. **意图忠实，所见即所想** —— 解析补全 → 秒级大纲对齐 → 全文生成 → 廉价局部迭代。
3. **内容详实、风格可选可定制** —— 质量基线 + 风格自主权。
4. **互动原生，课堂双向** —— 互动块是课件结构的一等公民。

贯穿全部的工程信条：**结构化内容与渲染分离**。课件是一份 JSON 数据模型，
渲染层确定性呈现——它一肩三任：多端自适应、换模板而内容不变、原生互动。

---

## 技术栈（默认选型，可调整）

- **框架**：Next.js 15（App Router）+ React 19 + TypeScript
- **样式**：Tailwind CSS + CSS 变量（运行时主题切换）
- **数据库**：PostgreSQL + Prisma（课件内容存 JSONB）
- **AI**：LLM Provider 抽象层（默认国产模型，可切换），多 Agent 流水线
- **PWA**：Serwist（Service Worker、离线缓存）
- **存储**：S3 兼容对象存储（图片 / PPT 上传 / PDF 导出）

详见 [docs/01-tech-stack.md](docs/01-tech-stack.md)。

---

## 本地开发（脚手架就绪后）

```bash
npm install          # 安装依赖
cp .env.example .env # 配置环境变量（数据库、LLM Key 等）
npm run dev          # 启动开发服务器 http://localhost:3000
```

> 当前为规划阶段，脚手架配置已就绪；首次运行需补齐 `.env` 中的密钥。
