# curs5

Курсовая. Внутри — Node.js бэкенд (Express + Socket.IO + PostgreSQL + Redis) и
кучка статических HTML-страниц фронта, которые этот же бэкенд и отдаёт.
Всё завёрнуто в Docker, чтобы не плясать с локальной установкой Postgres и
Node.

## Что нужно

Только Docker Desktop. Больше ничего ставить не надо — ни Node, ни Postgres,
ни Redis. Версия Docker подойдёт любая свежая (тестировал на v27).

Порты, которые должны быть свободны на хосте: `3001`, `5432`, `6379`,
а также `1025` и `8025` для Mailpit. Если что-то занято — поменяйте
`*_PORT_HOST` в `.env`.

## Как запустить

Скачать репозиторий, зайти в папку, дважды кликнуть `up.bat` (Windows) или
`./start.sh` (Linux/macOS). На первый запуск уйдёт минуты три — качается
Node-образ и npm-зависимости. Дальше — секунды.

После старта откроется http://localhost:3001/frontend/main-module.html

Логин/пароль тестового админа уже зашит в SQL-схему:

```
testadmin2@mail.com
12345678
```

Если предпочитаете руками:

```bash
docker compose up --build -d
docker compose logs -f backend
```

## Управление

Самый удобный путь — запустить `curs5.bat`. Это меню, в котором всё, что
обычно нужно: старт, стоп, рестарт бэкенда после правки `.env`, логи,
открытие приложения и Mailpit в браузере, `psql` внутрь контейнера,
шелл в backend, полная очистка.

Если меню не нужно — есть короткие батники:

| Файл                  | Что делает                                              |
|-----------------------|---------------------------------------------------------|
| `up.bat`              | поднимает всё и открывает приложение в браузере         |
| `down.bat`            | гасит контейнеры (данные остаются)                      |
| `down.bat --purge`    | гасит и удаляет volume'ы (БД будет пересоздана с нуля)  |
| `restart-backend.bat` | пересоздаёт только backend — после правки `.env`        |
| `logs.bat`            | хвост логов backend, выход — Ctrl-C                     |

Для Linux/macOS — `curs5.sh`, `start.sh`, `stop.sh` с тем же смыслом.

## Что внутри (для понимания)

Четыре контейнера:

- `curs5-postgres` — PostgreSQL 16. Схема `backend/base_data/shema.sql`
  применяется автоматически при первом запуске пустого тома.
- `curs5-redis` — Redis 7. Используется для сессий и rate-limit.
- `curs5-backend` — Node.js 20. Кроме API, отдаёт `frontend/` как статику.
- `curs5-mailpit` — фейковый SMTP с веб-интерфейсом на :8025. Нужен только
  если в `.env` не задан реальный SMTP. Иначе просто стоит молча.

Данные лежат в volume'ах `curs5_pg_data`, `curs5_redis_data`, `curs5_app_logs`.
Пока вы их не удалили — БД переживает любые `down` и пересборки.

## `.env`

Файл `.env` уже лежит в репозитории с рабочими значениями (это не прод,
секреты можно). Что там стоит знать:

- `DB_HOST` и `REDIS_URL` сюда **не пишите** — они захардкожены в
  `docker-compose.yml`, потому что внутри докер-сети сервисы находятся
  по именам (`postgres`, `redis`), а не по `localhost`.
- Если хотите отправлять реальные письма (например, через Gmail) —
  заполните `SMTP_HOST/PORT/USER/PASS/FROM/EMAIL_USER`. Для Gmail нужен
  App Password (не пароль от аккаунта).
- Если оставите `SMTP_*` пустыми — все письма уйдут в Mailpit, открываете
  http://localhost:8025 и смотрите.
- `AI_API_URL` — это куда бэкенд ходит за ответами AI. Если LM Studio
  стоит у вас на той же машине, используйте `http://host.docker.internal:1234/v1`.
  Если на другом компьютере по Tailscale — `http://<его-tailscale-ip>:1234/v1`.
  В самом LM Studio обязательно включить «Serve on Local Network»,
  иначе слушает только 127.0.0.1 и снаружи никто не достучится.
- OAuth (Google/Yandex/VK) выключен, если соответствующие `_CLIENT_ID/SECRET`
  пустые. Иконки на форме логина в этом случае при клике вернут 500 —
  это особенность исходного кода, на остальной функционал не влияет.

После правки `.env` нужен **рестарт backend**:

```bash
docker compose up -d --force-recreate backend
```

либо `restart-backend.bat`, либо пункт `[4]` в меню `curs5.bat`.

## Что было поправлено в исходниках

Чтобы оно вообще завелось, пришлось поправить пару мест в `backend/`:

1. В `package.json` не было `winston` и `winston-daily-rotate-file`, хотя
   `server.js` их `require`-ит. Dockerfile доустанавливает их отдельно.
2. В `backend/base_data/shema.sql` — две вещи: в таблице `users` не
   хватало запятых после двух `BOOLEAN DEFAULT TRUE`, и `chat_messages`
   создавалась раньше `tickets`, на которую ссылается. Поправил.

Сам код приложения никак не трогал.

## Когда что-то не работает

**`port is already allocated`** — поменяйте `*_PORT_HOST` в `.env` на
свободные и `up.bat` заново.

**В логах `Skipping initialization` у postgres, а в БД пусто** — значит,
вы запускали Postgres с другим именем БД/паролем, у вас остался старый
volume, и схема не применилась. Лечится `down.bat --purge` + `up.bat`.

**`Error: Пользователь не найден` при входе** — у вас в браузере остались
куки/JWT от прошлой жизни БД (вы делали `--purge`). Зайдите в инкогнито
или почистите cookies сайта.

**`Failed to send email` / `ECONNREFUSED 127.0.0.1:587`** — в `.env`
прописан SMTP, до которого бэкенд не может достучаться. Либо очистите
SMTP-блок (письма поедут в Mailpit), либо проверьте, что хост/порт
живые и снаружи доступны.

**`ai error: connect ECONNREFUSED <ip>:1234`** — LM Studio либо не запущен,
либо у него Start не нажат, либо «Serve on Local Network» выключен.
Проверьте на той машине, где он стоит: `curl http://localhost:1234/v1/models`
должен вернуть JSON.

**Кириллица в `.bat` сыпет «is not recognized as a command»** — это
известная боль cmd.exe. Все батники в репозитории уже в ASCII, проблемы
быть не должно. Если редактируете — сохраняйте в ASCII/CRLF, не в UTF-8.

## Полезные команды напрямую

```bash
docker compose ps                                  # кто живой
docker compose logs -f backend                     # хвост логов
docker compose exec backend sh                     # внутрь контейнера
docker compose exec postgres psql -U helpdesk -d helpdesk
docker compose exec redis redis-cli
docker compose down                                # стоп
docker compose down -v                             # стоп и снести БД
```

## Структура

```
curs5/
├── backend/                 # Node.js приложение
│   ├── Dockerfile           # образ бэкенда
│   ├── base_data/shema.sql  # схема БД, грузится в Postgres автоматом
│   ├── controllers/ services/ routes/ ...
│   └── server.js
├── frontend/                # статические HTML/CSS/JS
├── docker-compose.yml       # postgres + redis + mailpit + backend
├── .env                     # реальные настройки (включая SMTP)
├── .env.example             # шаблон
├── curs5.bat / curs5.sh     # меню управления
├── up.bat / down.bat / logs.bat / restart-backend.bat
└── README.md                # этот файл
```
