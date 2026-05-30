#!/usr/bin/env bash
# curs5 — интерактивное меню управления Docker-стеком (Linux/macOS).
set -euo pipefail
cd "$(dirname "$0")"

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "❌ Не найден ни 'docker compose', ни 'docker-compose'."
  exit 1
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  echo "ℹ️  .env не найден — копирую из .env.example"
  cp .env.example .env
fi

OPEN_CMD=""
if command -v xdg-open >/dev/null 2>&1; then OPEN_CMD=xdg-open
elif command -v open >/dev/null 2>&1; then OPEN_CMD=open
fi

while true; do
  clear
  echo "============================================================"
  echo " curs5 — Docker control panel"
  echo "============================================================"
  $DC ps 2>/dev/null || true
  echo "============================================================"
  cat <<'MENU'
 [1] Запустить (build + up -d)
 [2] Запустить БЕЗ пересборки
 [3] Остановить (контейнеры)
 [4] Перезапустить backend (после правки .env)
 [5] Полностью пересобрать backend (--no-cache)
 [6] Логи backend (Ctrl+C — выход из логов)
 [7] Логи ВСЕХ сервисов
 [8] Статус контейнеров
 [9] Открыть приложение в браузере
 [m] Открыть Mailpit в браузере
 [p] PSQL внутри контейнера postgres
 [b] Shell внутри контейнера backend
 [r] ПОЛНАЯ ОЧИСТКА (down -v: удалит данные БД!)
 [0] Выход
MENU
  echo "============================================================"
  read -rp "Выберите пункт: " choice
  case "${choice}" in
    1)
      $DC up --build -d
      echo "✅ Готово. Открываю приложение через 3 сек..."
      sleep 3
      [ -n "$OPEN_CMD" ] && $OPEN_CMD http://localhost:3001/frontend/main-module.html || true
      read -rp "Enter — в меню" _
      ;;
    2) $DC up -d; read -rp "Enter — в меню" _ ;;
    3) $DC down; read -rp "Enter — в меню" _ ;;
    4) $DC up -d --force-recreate backend; read -rp "Enter — в меню" _ ;;
    5)
      $DC build --no-cache backend
      $DC up -d backend
      read -rp "Enter — в меню" _
      ;;
    6) $DC logs -f --tail=200 backend ;;
    7) $DC logs -f --tail=100 ;;
    8) $DC ps; read -rp "Enter — в меню" _ ;;
    9) [ -n "$OPEN_CMD" ] && $OPEN_CMD http://localhost:3001/frontend/main-module.html || echo "Откройте http://localhost:3001/frontend/main-module.html" ; sleep 1 ;;
    m|M) [ -n "$OPEN_CMD" ] && $OPEN_CMD http://localhost:8025 || echo "Откройте http://localhost:8025" ; sleep 1 ;;
    p|P)
      DBN=$(grep -E '^DB_NAME=' .env | head -n1 | cut -d= -f2-)
      DBU=$(grep -E '^DB_USER=' .env | head -n1 | cut -d= -f2-)
      $DC exec postgres psql -U "${DBU:-curs5}" -d "${DBN:-curs5}"
      ;;
    b|B) $DC exec backend sh ;;
    r|R)
      read -rp "⚠️  Удалить ВСЁ (включая БД)? (y/N): " ok
      if [ "${ok:-N}" = "y" ] || [ "${ok:-N}" = "Y" ]; then
        $DC down -v
        echo "✅ Очищено."
      fi
      read -rp "Enter — в меню" _
      ;;
    0) exit 0 ;;
    *) ;;
  esac
done
