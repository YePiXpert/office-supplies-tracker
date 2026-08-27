#!/bin/sh
# server 容器入口：建表（迁移优先，db push 兜底）→ 启动 API
# 用脚本文件而非 Dockerfile CMD，绕开 JSON/exec-form 的转义解析坑
set -e
cd /app/apps/server

export DATABASE_URL="${DATABASE_URL:-file:${DATA_DIR:-/app/state}/procure.db}"

echo "[entrypoint] DATABASE_URL=$DATABASE_URL"
npx prisma migrate deploy || npx prisma db push --skip-generate

exec node dist/main.js
