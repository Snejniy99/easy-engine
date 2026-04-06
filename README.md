# Easy Engine

**Easy Engine** — это ядро: готовый каркас для веб-проектов, куда вы добавляете свою логику. Не «ещё одна CMS из коробки», а основа, на которой можно собрать личный кабинет, админку, публичные страницы, внутренний сервис или прототип — с пользователями, ролями, плагинами и оформлением через темы.

Движок даёт общую инфраструктуру: маршруты панели и публичной зоны, сессии, CSRF, хранилище файлов для плагинов, WebSocket-хаб, переключаемые темы и точки расширения. Всё остальное — ваши модули в `plugins/` и шаблоны.

Стек: **Fastify**, **PostgreSQL**, **Drizzle ORM**, шаблоны **EJS**, рантайм **Bun**.

Распространение — **только через Git** (клон репозитория); в реестре npm пакет не публикуется.

## Документация

**[Документация](https://snejniy99.github.io/index.html)**

## Требования

- [Bun](https://bun.sh)
- PostgreSQL

## Быстрый старт

1. Скопируйте переменные окружения (минимум строка подключения к БД):

   ```bash
   # Пример: DATABASE_URL=postgres://user:password@localhost:5432/dbname
   ```

2. Установите зависимости и примените схему к БД:

   ```bash
   bun install
   bun run db:push
   ```

3. (Опционально) создайте первого администратора:

   ```bash
   bun run eecli seed:admin
   ```

4. Запуск:

   ```bash
   bun run dev
   ```

   Режим с автоперезапуском при правках файлов. Без watch:

   ```bash
   bun run start
   ```

По умолчанию HTTP — порт **3000**; переопределение: переменная **`PORT`**.

## Продакшен

1. На сервере с **Bun** и **PostgreSQL**: клон репозитория, `bun install`, в корне **`.env`** (или переменные окружения у процесса): `DATABASE_URL`, **`NODE_ENV=production`**, **`SESSION_KEY`** (32 байта, например `openssl rand -hex 32`), при необходимости **`PORT`**, **`STORAGE_ROOT`**, лимиты из `env.example`.
2. Схема БД: `bun run db:push` (или привычный вам поток с `db:generate` и миграциями).
3. Первый админ: `bun run eecli seed:admin` с **`ADMIN_EMAIL`** и **`ADMIN_PASSWORD`** в окружении (один раз).
4. Запуск процесса: **`bun run start`** — слушает **`0.0.0.0`** и **`PORT`** (см. `index.ts`). Перед клиентом обычно ставят **reverse proxy** (Nginx, Caddy и т.д.) с TLS и проксированием на `localhost`:`PORT`.
5. Управление процессом: **systemd**, **Docker**, **PM2** с Bun или аналог — с автоперезапуском и логами; `SIGTERM`/`SIGINT` корректно завершают приложение.

Отдельный шаг **production-сборки** не обязателен: для сервера на **Bun** типично запускать `.ts` с исходников, рантайм сам обрабатывает TypeScript; шаблоны **EJS** читаются с диска при работе — так же делают многие продакшен-приложения на Bun/Node. Если понадобится один бинарник или политика «на сервере только JS», можно добавить свой этап (например `bun build` / `bun build --compile`) в CI и деплой.

## CLI (eecli)

В `package.json` для утилит командной строки задано только **`bun run eecli`**; подкоманды (`seed:admin`, `plugin:scaffold` и т.д.) вызываются через неё.

```bash
bun run eecli --help
bun run eecli list
```

**Встроенные** (кратко): `routes:list`, `seed:admin` (нужны `ADMIN_EMAIL`, `ADMIN_PASSWORD`), `plugin:scaffold <id>`, `theme:scaffold <id>`, `command:scaffold <foo:bar>`, `list`.

**Свои команды** — файлы `cli/commands/**/*.ts`: путь `foo/bar.ts` даёт команду `bun run eecli foo:bar`. Экспорт: `export default { description?, run(ctx, args) }` (или `cliCommand`). Контекст `ctx`: `rootDir` и `db` (Drizzle). Имена встроенных команд не дублируйте в `cli/commands/`.

Подробности — в [документации](https://snejniy99.github.io/index.html).

## Структура проекта (кратко)

| Путь | Назначение |
|------|------------|
| `core/` | Движок: маршруты, БД, плагины, темы, WS |
| `plugins/` | Плагины (каждый в своей папке); `plugins/example` — простой пример |
| `cli/commands/` | Пользовательские команды: `foo/bar.ts` → `eecli foo:bar`, в справке рядом со встроенными (`export default { description?, run }`) |
| `resources/views/` | Общие шаблоны и fallback layout |
| `resources/themes/` | Темы (`default` и др.) |

## Скрипты

| Команда | Описание |
|---------|----------|
| `bun run dev` | Разработка с перезапуском |
| `bun run start` | Обычный запуск |
| `bun run eecli` | CLI — см. [раздел выше](#cli-eecli) и [документацию](https://snejniy99.github.io/index.html) |
| `bun run db:push` | Синхронизация схемы Drizzle с БД |
| `bun run db:generate` | Генерация миграций |
| `bun run db:studio` | Drizzle Studio |

## Лицензия

[MIT](LICENSE) © 2026 Новоселов Вадим Русланович.
