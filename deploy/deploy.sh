#!/usr/bin/env bash
# Procure Lite 首次部署脚本（在 VPS 的仓库根目录执行）
# 用法：bash deploy/deploy.sh [端口]
set -euo pipefail

cd "$(dirname "$0")/.."
WEB_PORT="${1:-8080}"

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
EOF
  chmod 600 .env
  info "已生成 .env（含随机 OCR_API_KEY）"
else
  info "复用已有 .env"
fi

# 端口覆盖：写回 .env（docker-compose.yml 读取 WEB_PORT，默认 8080）
if grep -q '^WEB_PORT=' .env; then
  sed -i "s/^WEB_PORT=.*/WEB_PORT=$WEB_PORT/" .env
else
  echo "WEB_PORT=$WEB_PORT" >> .env
fi

# ---------- 构建并启动 ----------
info "构建镜像并启动（首次构建 OCR 镜像较慢，约 5-15 分钟）…"
docker compose up -d --build

# ---------- 健康检查 ----------
info "等待服务就绪…"
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${WEB_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  [ "$i" = 60 ] && die "健康检查超时，查看日志：docker compose logs -f server"
  sleep 3
done
for i in $(seq 1 30); do
  OCR_OK=$(curl -fsS "http://127.0.0.1:${WEB_PORT}/api/system/ocr-health" 2>/dev/null || true)
  if [ "$OCR_OK" = "true" ]; then
    info "OCR 解析服务正常（模型已加载）"
    break
  fi
  [ "$i" = 30 ] && warn "OCR 服务 90 秒内未就绪（冷启动可能仍在下载模型），稍后在「系统设置」里确认其状态"
  sleep 3
done

info "部署完成 ✓  访问 http://<服务器IP>:${WEB_PORT} 设置管理员密码"
info "常用命令："
info "  docker compose logs -f          # 看日志"
info "  docker compose restart server   # 重启 API"
info "  bash deploy/upgrade.sh          # 升级版本"
