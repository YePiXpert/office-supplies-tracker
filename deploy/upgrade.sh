#!/usr/bin/env bash
# Procure Lite 升级脚本：拉代码 → 备份 → 重建 → 健康检查
# 用法：
#   bash deploy/upgrade.sh            # 常规升级（只重建 web/server，OCR 镜像很少变）
#   bash deploy/upgrade.sh --full     # 全量重建（含 OCR 镜像）
#   bash deploy/upgrade.sh --no-pull  # 不拉取远程，只重建当前代码
set -euo pipefail

cd "$(dirname "$0")/.."
FULL=0
PULL=1
for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
    --no-pull) PULL=0 ;;
    *) echo "未知参数：$arg（支持 --full / --no-pull）" >&2; exit 1 ;;
  esac
done

info() { printf '\033[1;34m[升级]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[错误]\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "缺少 docker"
docker compose version >/dev/null 2>&1 || die "缺少 docker compose 插件"
[ -f .env ] || die "未找到 .env（请先执行 deploy/deploy.sh）"

OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# ---------- 拉取新代码 ----------
if [ "$PULL" = 1 ]; then
  info "拉取最新代码…"
  git fetch --all --tags
  git reset --hard origin/main
  git clean -fd --exclude=.env --exclude=pre-upgrade-backups
fi
NEW_COMMIT=$(git rev-parse --short HEAD)
info "版本：$OLD_COMMIT → $NEW_COMMIT"
if [ "$OLD_COMMIT" = "$NEW_COMMIT" ] && [ "$PULL" = 1 ]; then
  info "代码无变化，仍继续执行备份与重建（可用 --no-pull 跳过拉取）"
fi

# ---------- 预先构建（不停机） ----------
SERVICES="web server"
[ "$FULL" = 1 ] && SERVICES="web server ocr"
info "构建镜像：$SERVICES …"
docker compose build $SERVICES

# ---------- 停机 + 备份 ----------
info "停止服务并备份当前数据…"
docker compose down --remove-orphans

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="pre-upgrade-backups"
mkdir -p "$BACKUP_DIR"
VOLUME="procure-lite_procure-state"
if ! docker volume ls --format '{{.Name}}' | grep -qx "$VOLUME"; then
  die "找不到数据卷 $VOLUME（compose 项目名若改过请手动调整脚本）"
fi
docker run --rm \
  -v "$VOLUME:/state:ro" \
  -v "$(pwd)/$BACKUP_DIR:/backup" \
  alpine tar czf "/backup/pre-upgrade-$STAMP.tar.gz" -C /state .
info "已备份：$BACKUP_DIR/pre-upgrade-$STAMP.tar.gz（数据库 + 附件 + 配置）"

# 最多保留最近 5 份升级备份
ls -1t "$BACKUP_DIR"/pre-upgrade-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f

# ---------- 启动新版本 ----------
info "启动新版本…"
docker compose up -d

WEB_PORT=$(grep '^WEB_PORT=' .env | cut -d= -f2 || echo 8080)
WEB_PORT="${WEB_PORT:-8080}"
info "健康检查…"
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${WEB_PORT}/api/health" >/dev/null 2>&1; then
    info "升级完成 ✓  $OLD_COMMIT → $NEW_COMMIT"
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 3
done

cat <<EOF >&2
================================================================
健康检查超时。排查步骤：
  1. docker compose logs --tail 100 server web
  2. 若需回滚到升级前状态：
     docker compose down
     docker run --rm -v $VOLUME:/state -v "$(pwd)/$BACKUP_DIR:/backup" alpine \\
       sh -c "rm -rf /state/* && tar xzf /backup/pre-upgrade-$STAMP.tar.gz -C /state"
     git reset --hard $OLD_COMMIT
     docker compose up -d --build web server
================================================================
EOF
exit 1
