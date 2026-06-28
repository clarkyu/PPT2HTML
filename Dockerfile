# syntax=docker/dockerfile:1
#
# 言课 生产镜像（长驻 Node 进程，next start）。开箱内置 PDF 导出所需的 Chromium 与中文字体。
# 适用 Railway / Render / Fly / 任意支持 Dockerfile 的容器平台。本地：docker build -t yanke .

############################# 构建阶段 #############################
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# 先复制清单再装依赖，命中层缓存（源码变更不必重装依赖）。
COPY package.json package-lock.json ./
RUN npm ci

# 复制源码并构建。next build 期间 NEXT_PHASE=phase-production-build 由 Next 自动注入，
# 故构建期不会触发 DB/OTP 的「生产硬失败」（见 src/lib/db.ts、src/auth/otp/index.ts）。
# 构建同时由 Serwist 生成 public/sw.js（PWA Service Worker）。
COPY . .
RUN npm run build

# 移除 devDependencies，仅留运行时依赖（pptxgenjs 等仅测试用，可安全裁掉）。
RUN npm prune --omit=dev

############################# 运行阶段 #############################
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Chromium（PDF 导出）+ 中文字体。用发行版 chromium 包：自动带齐运行所需共享库，
# 免去逐个手补依赖。fonts-noto-cjk 为豆腐块兜底（应用本身已内置打印路由字体）。
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       chromium \
       fonts-noto-cjk \
       ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 非 root 运行：PDF 导出会以 --no-sandbox 渲染「按链接公开」的任意课件内容，
# 万一渲染进程被攻破，也只落到非特权用户、拿不到容器内 root（纵深防御）。
RUN useradd --create-home --uid 1001 app

# 导出路由按此路径直指 Chromium 可执行文件（见 src/app/api/export/[id]/route.ts）。
ENV PW_CHROMIUM_PATH=/usr/bin/chromium

# 从构建阶段整套复制并归属 app（next start 的缓存、npm 缓存等运行时写入需可写）。
# 含 .next、public、裁剪后的 node_modules、scripts、迁移 SQL；迁移脚本运行时需读 src/db/migrations/*.sql。
COPY --from=builder --chown=app:app /app ./

# 平台通过 $PORT 注入实际端口（Railway 等）；本地默认 3000。
ENV PORT=3000
EXPOSE 3000

# 切到非特权用户运行（apt 安装与建用户须在此之前以 root 完成）。
USER app

# 容器内自探活（平台另有自己的 healthcheck，见 railway.json）。Node 22 自带全局 fetch。
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# 启动：先应用数据库迁移（幂等、可重入），再拉起长驻进程。
# 用 sh -c 串联 && —— 迁移失败则容器以非零码退出，绝不带着旧库结构静默上线。
# 监听 0.0.0.0 以便容器外可达；端口取平台注入的 $PORT。
CMD ["sh", "-c", "npm run db:init && npm run start -- --port ${PORT:-3000} --hostname 0.0.0.0"]
