# 09 · 上线部署检查清单

把散落在各里程碑评审里的「生产前 TODO」收敛为一份可执行清单。面向**长驻 Node 进程**（`next start`）
部署；serverless 的差异在文末单列。配合 `.env.example`（权威变量样例）阅读。

> 约定：✅ = 已在代码内就绪；⚠️ = 上线前必须人工处理；🔭 = 规模化/后续增强项。

---

## 1. 运行形态与依赖

- **Node ≥ 20**（见 `package.json` engines）。
- **PostgreSQL 16+**：生产唯一持久化后端。未配 `DATABASE_URL` 时进程在生产会**硬失败拒绝启动**
  （`src/lib/db.ts`），避免以内存回退静默上线导致数据不持久。
- **Chromium**（PDF 导出）：需可执行的 Chromium，路径由 `PW_CHROMIUM_PATH` 指定（默认 `/opt/pw-browsers/chromium`）。
  - 中文字体：✅ 已随应用内置 `public/fonts/noto-sans-sc-400.woff2`（仅打印路由加载），导出 PDF 自带中文字形，
    不依赖宿主机字体；若运行镜像另装 `fonts-noto-cjk` 亦可，但非必需。
  - ⚠️ 沙箱：当前以 `--no-sandbox` 启动 Chromium（容器内常以 root 运行的折中）。条件允许时应**以非 root 用户运行并启用沙箱**，
    渲染「按链接公开」的任意课件内容时更安全。
- **HTTPS**：PWA（Service Worker）与安全 Cookie 均要求 HTTPS；TLS 一般在反代/网关终止。

## 2. 环境变量

### 必填（缺失会导致启动失败或核心功能不可用）

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串。托管库需 TLS：追加 `?sslmode=require` 或设 `PGSSL=require`。⚠️ |
| `AUTH_SECRET` | Auth.js 会话签名密钥，`openssl rand -base64 32` 生成，经平台 secret 注入，**切勿提交**。⚠️ |
| `SMS_PROVIDER` + `SMS_*` | 生产登录所需。未配置时 OTP 路由在生产**硬失败**（拒绝以 mock 渠道上线）。⚠️ 见 §6。 |

### 推荐 / 可选

| 变量 | 说明 |
| --- | --- |
| `AUTH_URL` | 站点 URL（`https://域名`）。固定后会话/回调不再依赖可伪造的 `x-forwarded-proto`/`Host`。 |
| `EXPORT_ORIGIN` | 服务端渲染打印页所用 origin；固定可消除 Host 头注入/SSRF 面（默认取请求 origin）。 |
| `EXPORT_MAX_CONCURRENT` | 同时进行的 PDF 导出数（默认 2）。每个启动一个 Chromium（约 200–300MB），按实例内存调。 |
| `PW_CHROMIUM_PATH` | Chromium 可执行文件路径（默认 `/opt/pw-browsers/chromium`）。 |
| `PGSSL` / `PG_POOL_MAX` / `PG_IDLE_TIMEOUT_MS` / `PG_CONN_TIMEOUT_MS` | 连接 TLS 与连接池参数。 |
| `TRUST_PROXY_XFF` | 仅当反代**强制重写**（而非透传）`X-Forwarded-For` 时设 `1`，使限流按真实 IP 生效。 |
| `LLM_DEFAULT_PROVIDER` + `DEEPSEEK_API_KEY` / `GEMINI_API_KEY` + `LLM_MODEL_*` | 生成用 LLM。未配置任何 Key 时回落离线 Mock（产出示例课件，生成质量受限）。 |
| `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_BASE_URL` | 展示用。 |

## 3. 数据库

- ⚠️ **执行迁移**：部署/升级时运行 `npm run db:init`（版本化、按序、单事务、幂等；记录于 `schema_migrations`）。
- ✅ 连接池单例 + 空闲连接 `error` 监听 + `SIGTERM/SIGINT` 优雅关闭（`src/lib/db.ts`）。
- 🔭 **图片资源**：当前存于 `assets` 表 BYTEA（M5 过渡）。上规模前迁移到 S3 兼容对象存储
  （`.env.example` 已备 `S3_*`），DB 仅留元数据——否则 `pg_dump`/备份会被图片体积绑架。
- 🔭 **连接数**：多副本时保证 `PG_POOL_MAX × 副本数 ≤ max_connections`，副本多时前置 **PgBouncer**。
- 备份：定期 `pg_dump` / 托管库 PITR；迁移前先备份。

## 4. 构建与启动

```bash
npm ci                 # 安装依赖（含 playwright-core，PDF 导出运行时依赖）
npm run build          # 生产构建（含 Serwist 生成 /public/sw.js）
npm run db:init        # 应用数据库迁移
npm run start          # 启动（next start，长驻进程）
```

> ⚠️ 生产安装若用 `npm ci --omit=dev`，确认 `playwright-core` 在 `dependencies`（已是）；它被导出路由运行时 import。

## 5. 安全检查清单

- [ ] ⚠️ `AUTH_SECRET` 为强随机值，**绝非**样例占位（`change-me-…` / `dev-insecure-…`）。占位泄漏即可伪造任意用户会话。
- [ ] ⚠️ **轮换任何曾以明文出现/共享过的凭据**（LLM API Key、短信密钥等）；`.env` 永不入库（已 gitignore）。
- [ ] ✅ 生产会话 Cookie 启用 `Secure` + `__Secure-/__Host-` 前缀（`useSecureCookies`）。需反代透传 `X-Forwarded-Proto: https`，或设 `AUTH_URL`。
- [ ] ✅ 写操作鉴权（401/403/认领）、读取按链接公开（产品决策）。课件 id/资源 id 为 CSPRNG，不可枚举。
- [ ] ✅ 各路由内存限流就绪；🔭 多副本下不跨实例共享，规模化需换 **Redis / 网关限流**（见 §7）。
- [ ] ✅ PDF 导出：全局并发闸 + 渲染超时 + 页数上界；`EXPORT_ORIGIN` 固定以收敛 SSRF 面。
- [ ] 反代/WAF：限制请求体大小（导入上限 25MB，应用层已校验）、超时、基础防爬。

## 6. 生产前必做（功能补全）

- [ ] ⚠️ **接入真实短信渠道**：`src/auth/otp/sms.ts` 目前是 stub（调用即抛错）。配 `SMS_PROVIDER` 后必须实现具体服务商
      （阿里云/腾讯云短信等）调用，否则生产无法登录（缺 `SMS_PROVIDER` 会硬失败、配了但未实现会 500）。
- [ ] 🔭 图片迁移对象存储（见 §3）。
- [ ] 验证 LLM Key 有效、额度充足；确认默认 provider 与各档位模型符合预期。

## 7. 多副本 / 扩展（已知限制）

当前若干「过渡实现」是**单进程内存态**，水平扩展前需替换：

- **限流**（`src/lib/rate-limit.ts`）：内存固定窗口，不跨副本 → 换 Redis 或在网关层限流。
- **PDF 并发闸**（导出路由）：进程内计数，不跨副本 → 配合队列/网关或共享信号量。
- **内存回退存储**：仅用于本地/CI/无 DB；生产必须 `DATABASE_URL`（已硬失败兜底）。注意内存回退在 page/route 不同打包层间
  不共享状态，仅适合演示。
- 部署形态（长驻 vs serverless）未最终确定时，按实际副本数核算连接池与并发闸。

## 8. 上线后冒烟检查

- [ ] `/`（登录态/登出态）、`/login` 可访问；手机号收到验证码并能登录。
- [ ] 一句话生成跑通；导入一份 `.pptx` 跑通；编辑保存（乐观锁 409 行为正常）。
- [ ] `/deck/[id]` 预览、`/deck/[id]/play` 全屏播放正常。
- [ ] 导出横版/竖版 PDF 均成功，**中文不为豆腐块**、含公式/主题色。
- [ ] PWA：`/manifest.webmanifest`、`/sw.js` 200，可「添加到主屏」；断网时已访问页可用、未缓存页落 `/~offline`。
- [ ] `/api/health` 类探活（如平台需要，可后续补一个轻量端点）。

## 9. 回滚

- 代码：回滚到上一个发布 tag/commit 重新 `build` + `start`。
- 数据库：迁移以增量、向后兼容为原则（先加列/回填、再约束）；破坏性变更前必备份。本项目迁移幂等、按版本记账，
  回滚代码后旧迁移不会重复执行。

---

## 附：serverless 注意点

- 冷启动会反复启动 Chromium，PDF 导出延迟与成本更高；`maxDuration` 已设 60s，仍需平台支持长执行。
- 内存限流/并发闸在多实例下失效（见 §7）。
- 连接数：每实例连接池 × 并发实例易压垮 PG，优先 PgBouncer 或 serverless 友好的连接代理。
- `SIGTERM` 优雅关闭在 serverless 不保证触发，依赖平台实例回收。
