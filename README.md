# Procure Lite v2

自部署的办公用品采购台账：OA 审批单拍照/上传 → 本地 OCR 解析 → 采购执行看板 → 库存与领用发放 → 统计报表。单管理员、单机 Docker 部署、数据完全自持。

## 架构

```
┌──────────┐   /api    ┌──────────┐  HTTP(内网Key) ┌──────────────┐
│  nginx   │ ────────▶ │  NestJS  │ ─────────────▶ │ Python OCR   │
│ 静态前端  │           │ Prisma + │                │ PaddleOCR    │
│ (Vue 3)  │           │ SQLite   │                │ pdfplumber   │
└──────────┘           └────┬─────┘                └──────────────┘
                            │ state/ (db·uploads·backups·secret)
```

- **apps/web** — Vue 3.5 + Vite + TypeScript + Tailwind v4 + Reka UI（shadcn 风格自建组件）+ ECharts + PWA
- **apps/server** — NestJS 11 + Fastify + Prisma(SQLite) + argon2 认证 + 审计日志 + 备份恢复
- **apps/ocr** — FastAPI + PaddleOCR：PDF 文本层优先、栅格化 OCR 兜底、OA 界面噪音过滤、表格重建
- **packages/shared** — zod API 契约与状态枚举（前后端共享）

## 核心流程

1. **导入**：上传 OA 审批单（PDF/截图，手机可拍照）→ OCR 解析出流水号/部门/经办人/明细 → 校对去重后入台账
2. **执行**：看板流转 待采购 → 待到货 → 待分发；供应商价格记忆提供比价建议
3. **发放**：按领用人拆分发放（结余自动入库），或整单入库后从库存按需出库
4. **管理**：Excel 导出、修改历史回滚、审计日志、自动备份与一键恢复

## 本地开发

```bash
corepack enable && pnpm install
pnpm --filter @procure-lite/shared build

# 终端 1：OCR 服务（首次需 pip install -e "apps/ocr[paddle]"，或跳过仅做轻依赖测试）
cd apps/ocr && python -m venv .venv && . .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"           # 轻依赖（解析逻辑可测，不含 paddle）
pip install -e ".[paddle]"        # 完整 OCR 能力（较重）
uvicorn app.main:app --port 8000

# 终端 2：API + 前端
pnpm db:migrate                   # 初始化开发数据库
pnpm dev                          # API :3000 + Vite :5173（自动代理 /api）
```

访问 http://localhost:5173，首次进入设置管理员密码。

## 测试

```bash
pnpm test          # 前后端全部（vitest）
cd apps/ocr && pytest   # 解析器单测 + API 集成（无需 paddle）
```

## Docker 部署（VPS）

每次 push 到 `main`，GitHub Actions 会自动跑完全部测试后把三个镜像构建并推送到 GHCR（`ghcr.io/yepixpert/procure-lite-{web,server,ocr}`），**VPS 上不需要编译**，直接拉镜像。

> GHCR 包默认私有。首次发布后到 GitHub → 你的 Packages → 各镜像 → Settings → Change visibility 改为 **Public**（公开仓库无敏感信息）；或保持私有并在 VPS 上 `docker login ghcr.io`（PAT 勾选 `read:packages`）。

**首次部署**（服务器上装好 git 与 docker 后）：

```bash
git clone https://github.com/YePiXpert/procure-lite.git && cd procure-lite
bash deploy/deploy.sh          # 默认 8080 端口；自定义：bash deploy/deploy.sh 9000
```

脚本自动完成：生成 `.env`（随机 OCR_API_KEY）→ 从 GHCR 拉镜像并启动（拉取失败自动回退本地构建）→ 健康检查。首次访问 `http://<服务器IP>:8080` 设置管理员密码。

**版本升级**：

```bash
bash deploy/upgrade.sh             # git pull + 拉新镜像 → 备份数据 → 滚动升级
bash deploy/upgrade.sh --build     # 不等 CI，直接本地构建（--full 连 OCR 一起）
bash deploy/upgrade.sh --no-pull   # 只更新镜像，不动代码
```

升级前会自动把数据卷（数据库 + 附件 + 配置）打包到 `pre-upgrade-backups/`（保留最近 5 份），脚本末尾附带失败时的回滚命令。数据落在 `procure-state` 卷，日常还可在「系统设置」中开启自动备份并下载异地保存。

## 安全模型

- 单管理员，argon2id 密码哈希，登录失败 5 次锁定 15 分钟
- HttpOnly + SameSite=Strict 签名 Cookie 会话（30 分钟滑动过期），恢复码重置密码
- 所有 `/api/*` 经全局守卫鉴权；OCR 服务仅内网通信且校验 API Key
- 上传类型/大小白名单，备份恢复含 zip-slip 与解压限额防护
