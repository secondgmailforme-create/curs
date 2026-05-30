#!/usr/bin/env bash
# Быстрый запуск проекта curs5 в Docker.
# Использование: ./start.sh
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker не найден в PATH. Установите Docker и повторите."
  exit 1
fi

# Определяем команду docker compose (v2) или docker-compose (v1)
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "❌ Не найден ни 'docker compose', ни 'docker-compose'."
  exit 1
fi

if [ ! -f .env ]; then
  echo "ℹ️  .env не найден — копирую из .env.example"
  cp .env.example .env
fi

echo "▶ Сборка образов..."
$DC build

echo "▶ Запуск контейнеров..."
$DC up -d

echo
echo "✅ Готово. Состояние:"
$DC ps

cat <<'INFO'

🌐 Откройте в браузере:
   http://localhost:3001/frontend/main-module.html

📋 Полезное:
   Логи бэкенда:     docker compose logs -f backend
   Остановить:       ./stop.sh   (или: docker compose down)
   Полная очистка:   docker compose down -v
INFO
