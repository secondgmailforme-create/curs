# ---- Базовый образ ----
FROM node:20-alpine

# Установка системных пакетов, нужных для нативных модулей (bcrypt и т.п.)
RUN apk add --no-cache python3 make g++ tini

# Рабочая директория внутри контейнера
WORKDIR /app/backend

# Сначала копируем package*.json для кэширования слоёв
COPY backend/package*.json ./

# Устанавливаем зависимости.
# winston и winston-daily-rotate-file импортируются в server.js,
# но отсутствуют в package.json — доустанавливаем явно.
RUN npm install --omit=dev \
 && npm install winston winston-daily-rotate-file

# Копируем код бэкенда и фронтенда (статика отдаётся express.static из ../)
COPY backend ./
COPY frontend /app/frontend

# Папка для логов (server.js пишет в ../logs относительно backend/)
RUN mkdir -p /app/logs

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

# tini как PID 1 для корректной обработки сигналов
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
