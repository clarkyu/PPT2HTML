# 10 · Railway 部署一页手册

把言课最快地部署成一个**可公网访问的原型**。Railway = 容器 PaaS：连接 Git 仓库，它按本仓库的
`Dockerfile` 构建镜像、托管运行，并能一键挂一个 PostgreSQL。配合 `.env.example`（权威变量样例）与
`docs/09-deployment.md`（完整上线清单）阅读。

> ⚠️ **我（AI）无法替你点击部署**：下列步骤需你用自己的 Railway 账号、密钥与数据库执行。
> 本仓库已备好全部部署产物（`Dockerfile` / `railway.json` / `/api/health`），你照做即可。

---

## 0. 仓库里已就绪的东西

| 文件 | 作用 |
| --- | --- |
| `Dockerfile` | 生产镜像：内置 Chromium + 中文字体（PDF 导出开箱可用）；启动先跑数据库迁移再起服务。 |
| `railway.json` | 让 Railway 用 Dockerfile 构建，并以 `/api/health` 做健康检查、失败自动重启。 |
| `src/app/api/health/route.ts` | 轻量存活探针，返回 `200 {status:"ok"}`。 |

你**无需**改动这些，只需在 Railway 上连仓库、配环境变量。

## 1. 前置

- 一个 GitHub 账号（仓库 `clarkyu/PPT2HTML`）+ 一个 [Railway](https://railway.app) 账号。
- ⚠️ **先轮换任何曾以明文出现/共享过的密钥**（如此前对话里贴过的 DeepSeek / GemAPI Key）——
  泄漏过的 Key 视为已失效，去对应控制台重新生成，只把新值填进 Railway 变量，**绝不提交进仓库**。

## 2. 步骤（约 10 分钟）

1. **建项目**：Railway → New Project → Deploy from GitHub repo → 选 `clarkyu/PPT2HTML`，
   分支可先用本功能分支或合并后的 `main`。它会读到 `railway.json` + `Dockerfile` 自动开始构建。
2. **加数据库**：项目里 → New → Database → **Add PostgreSQL**（同项目，默认服务名 `Postgres`）。
3. **⭐ 把 `DATABASE_URL` 接到 app 服务**：选 **app 服务**（不是 Postgres）→ **Variables** → New Variable →
   名 `DATABASE_URL`，值填**引用** `${{Postgres.DATABASE_URL}}`。
   （Railway 不会自动把库的连接串注入到别的服务，需用这条引用变量显式接过去；`Postgres` 为上一步数据库服务名。）
   > 托管库走 TLS：若连接失败提示证书问题，给连接串末尾加 `?sslmode=require` 或设 `PGSSL=require`。
4. **配其余环境变量**（app 服务 → Variables，见下表 §3）：至少 `AUTH_SECRET`。想要能登录与真生成，按需加 OTP / LLM 项。
5. **公网域名**：app 服务 → Settings → Networking → **Generate Domain**。Railway 会注入 `$PORT`，
   镜像已监听 `0.0.0.0:$PORT`，无需改动。
6. **设 `AUTH_URL`**：拿到域名后填 `AUTH_URL=https://<你的域名>`，重新部署。
   （固定回调/重定向所用的站点 origin，不再依赖可伪造的 `Host`/`x-forwarded-*`。
   会话 Cookie 的 `Secure` 属性由 `NODE_ENV=production`（镜像已设）自动开启、与本项无关，但仍需边缘层为 HTTPS。）
7. **冒烟**：访问 `https://<域名>/api/health` 应返回 `{"status":"ok",...}`；首页可开 → 一句话生成 → 导出 PDF。

> 数据库迁移：容器**每次启动**会自动执行 `npm run db:init`（幂等、按版本记账，已应用的跳过），
> 无需手动跑。失败会让容器非零退出（不会带着旧库结构静默上线）。

## 3. 环境变量清单

### 必填

| 变量 | 怎么来 |
| --- | --- |
| `DATABASE_URL` | 加 PostgreSQL 插件后，在 app 服务用引用变量接入：`${{Postgres.DATABASE_URL}}`（见 §2.3）。 |
| `AUTH_SECRET` | 自己生成：`openssl rand -base64 32`，粘进 Variables。**绝不提交。** |

### 想要「能登录」（原型二选一）

| 方案 | 变量 | 说明 |
| --- | --- | --- |
| **A. 演示登录（最快）** | `OTP_ALLOW_MOCK=1` | 无需短信账号：验证码直接显示在登录页。⚠️ 任何人可凭回显码登录任意手机号，**仅限原型演示**。 |
| **B. 真实短信** | `SMS_PROVIDER=aliyun` + `SMS_ACCESS_KEY` / `SMS_SECRET_KEY` / `SMS_SIGN_NAME` / `SMS_TEMPLATE_ID`（或 `SMS_PROVIDER=http` + `SMS_WEBHOOK_URL`） | 正式上线用。详见 `.env.example` §短信。 |

> 不配以上任一项，生产下 **OTP 登录接口会拒绝服务**（`/api/auth/otp` 抛错）——防止以收不到验证码的
> mock 渠道静默上线。注意：容器**仍会正常启动并通过健康检查**，匿名流程照常可用，只是无法登录。
> 纯匿名体验（不登录也能用「按链接公开」的生成/导入/导出）可不配——但仍建议配 A 以便演示登录态。

### 想要「真实 AI 生成」（否则回落离线 Mock，产出示例课件）

| 变量 | 说明 |
| --- | --- |
| `LLM_DEFAULT_PROVIDER` | `deepseek` 或 `gemini`（默认 deepseek）。 |
| `DEEPSEEK_API_KEY` / `GEMINI_API_KEY` | 对应 provider 的 Key（**用轮换后的新值**）。 |
| `LLM_MODEL_LIGHT/STANDARD/HEAVY` | 可选，分级模型名（默认 `deepseek-chat`）。 |

### 推荐

| 变量 | 说明 |
| --- | --- |
| `AUTH_URL` | `https://<域名>`，拿到域名后必设（见 §2.5）。 |
| `EXPORT_ORIGIN` | `https://<域名>`，固定服务端打印页 origin，收敛 SSRF 面。 |
| `EXPORT_MAX_CONCURRENT` | 同时导出数（默认 2，每个起一个 Chromium 约 200–300MB）。按实例内存调。 |

### 可省（原型阶段）

- `S3_*` 对象存储：不配则图片回落存 DB（BYTEA）。原型可省；图片多/要长期用再迁 S3（见 `docs/09-deployment.md` §3）。
- `PW_CHROMIUM_PATH`：镜像已固定为 `/usr/bin/chromium`，无需设置。

## 4. 实例规格

PDF 导出会起 Chromium（约 200–300MB/并发）。建议实例内存 **≥ 1GB**（512MB 易在导出时 OOM）。
`EXPORT_MAX_CONCURRENT` 默认 2，小内存实例可降到 1。

## 5. 已知限制（原型 → 正式）

- **单副本**：限流与 PDF 并发闸是进程内存态，多副本不共享；启动期迁移在多副本下会竞态。
  原型保持 **1 个副本**即可；水平扩展见 `docs/09-deployment.md` §7（Redis 限流 / 发布期迁移 / PgBouncer）。
- **沙箱**：容器内以 `--no-sandbox` 跑 Chromium。渲染「按链接公开」的任意课件，正式环境应加固
  （非 root + 启用沙箱），见 `docs/09-deployment.md` §1。
- **演示登录开关** `OTP_ALLOW_MOCK` 上线前务必移除，换成真实短信渠道。

## 6. 其他平台

同一个 `Dockerfile` 可直接用于 **Render / Fly.io / Cloud Run / 任意容器平台**——把 §2/§3 的「连仓库 + 加 PG + 配变量」
换成对应平台的等价操作即可（健康检查路径同为 `/api/health`，端口同样读 `$PORT`）。
