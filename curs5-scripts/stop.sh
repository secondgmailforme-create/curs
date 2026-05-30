#!/usr/bin/env bash
# Остановка контейнеров curs5.
# Использование: ./stop.sh           — остановить, данные сохранить
#                ./stop.sh --purge   — остановить и удалить данные БД/Redis
set -euo pipefail
cd "$(dirname "$0")"

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi

if [ "${1:-}" = "--purge" ]; then
  echo "⚠️  Удаляю контейнеры И данные (volumes)..."
  $DC down -v
else
  $DC down
fi
echo "✅ Остановлено."
