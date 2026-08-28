#!/usr/bin/env bash
# Procure Lite 首次部署脚本（在 VPS 的仓库根目录执行）
# 用法：bash deploy/deploy.sh [端口]
# 镜像默认从 GHCR 拉取（CI 自动构建）；拉取失败时回退本地构建。
set -euo pipefail

cd "$(dirname "$0")/.."
WEB_PORT="${1:-8080}"
GHCR_OWNER="yepixpert"

info() { printf '\033[1;34m[部署]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[警告]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[错误]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------- 前置检查 ----------
command -v git >/dev/null 2>&1 || die "缺少 git"
if ! command -v docker >/dev/null 2>&1; then
  die "缺少 docker，请先安装：curl -fsSL https://get.docker.com | sh"
fi
if ! docker compose version >/dev/null 2>&1; then
  die "缺少 docker compose 插件（Docker 20.10+ 自带）"
fi
docker info >/dev/null 2>&1 || die "docker 守护进程未运行或当前用户无权限（试试 sudo）"

# ---------- 生成配置 ----------
if [ ! -f .env ]; then
  if command -v openssl >/dev/null 2>&1; then
    OCR_KEY=$(openssl rand -hex 16)
  else
    OCR_KEY=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  fi
  cat > .env <<EOF
# 部署时自动生成，可按需修改
OCR_API_KEY=$OCR_KEY
COMPOSE_PROJECT_NAME=procure-lite
WEB_PORT=$WEB_PORT
EOF
  chmod 600 .env
  info "已生成 .env（含随机 OCR_API_KEY）"
else
  info "复用已有 .env"
  if grep -q '^WEB_PORT=' .env; then
    sed -i "s/^WEB_PORT=.*/WEB_PORT=$WEB_PORT/" .env
  else
    echo "WEB_PORT=$WEB_PORT" >> .env
  fi
fi

# ---------- 获取镜像：优先拉取 GHCR ----------
info "拉取镜像（ghcr.io/$GHCR_OWNER/procure-lite-*）…"
if docker compose pull 2>&1; then
  info "镜像拉取完成"
  info "启动服务…"
  docker compose up -d --remove-orphans
else
  warn "镜像拉取失败（镜像未发布或为私有包未登录），回退到本地构建"
  if ! docker manifest inspect "ghcr.io/$GHCR_OWNER/procure-lite-server:latest" >/dev/null 2>&1; then
    warn "GHCR 上还没有镜像：push 到 GitHub 后 CI 会自动构建（约 10-25 分钟），或先本地构建"
  else
    warn "镜像存在但需要授权拉取，可执行："
    warn "  echo <GitHub PAT(read:packages)> | docker login ghcr.io -u $GHCR_OWNER --password-stdin"
    warn "或到 GitHub → Packages → 对应包 → Settings 改为 Public"
  fi
  info "本地构建镜像并启动（OCR 镜像较大，约 5-15 分钟）…"
  docker compose up -d --build
fi

# ---------- 健康检查 ----------
info "等待服务就绪…"
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${WEB_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  if [ "$i" = 60 ]; then
    warn "健康检查超时，server 最近日志："
    docker compose logs --tail 30 server 2>&1 | sed 's/^/    /'
    docker compose ps 2>&1 | sed 's/^/    /'
    die "请把以上日志发给维护者排查"
  fi
  sleep 3
done
for i in $(seq 1 30); do
  OCR_OK=$(curl -fsS "http://127.0.0.1:${WEB_PORT}/api/system/ocr-health" 2>/dev/null || true)
  if [ "$OCR_OK" = "true" ]; then
    info "OCR 解析服务正常（模型已加载）"
    break
  fi
  [ "$i" = 30 ] && warn "OCR 服务 90 秒内未就绪（冷启动可能仍在加载模型），稍后在「系统设置」里确认其状态"
  sleep 3
done

info "部署完成 ✓  访问 http://<服务器IP>:${WEB_PORT} 设置管理员密码"
info "常用命令："
info "  docker compose logs -f          # 看日志"
info "  docker compose restart server   # 重启 API"
info "  curl -fsSL https://raw.githubusercontent.com/YePiXpert/procure-lite/main/deploy/upgrade.sh | bash"
info "                                  # 一行升级（任意目录；仓库不在 ~/procure-lite 时用 bash -s -- <目录> 指定）"
