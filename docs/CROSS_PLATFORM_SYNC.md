# CROSS_PLATFORM_SYNC — работа на Windows и macOS одновременно

Этот документ описывает, как держать рабочую копию **ScreenerPRO** в синхроне между двумя машинами (Windows + macOS) через GitHub.

> **Главный принцип:** «источник правды» — это **`origin/main` на GitHub**, а не локальная папка. Перед началом работы — `pull`. После работы — `save`.

---

## 1. Что уже настроено

| Платформа | Запуск dev-сервера | Helper-скрипт sync |
|-----------|--------------------|--------------------|
| **Windows** | `run-dev.cmd` (быстрый) / `run-dev-full.cmd` (полный, с Prisma + MOEX ingest) | `sync.cmd` или `sync.ps1` |
| **macOS / Linux** | `./run-dev.sh` (быстрый) / `./run-dev-full.sh` (полный) | `./sync.sh` |

Команды зеркальны: всё, что есть на Windows, есть и на Mac.

`.gitattributes` нормализует переводы строк:
- весь код хранится в репозитории с `LF`;
- `*.cmd`, `*.bat`, `*.ps1` принудительно получают `CRLF` при checkout — чтобы Windows их корректно выполнял.

---

## 2. Первая установка на новой машине

### macOS

```bash
# 1. установить базу
brew install git node pnpm

# 2. склонировать репозиторий
mkdir -p ~/Pro && cd ~/Pro
git clone https://github.com/kendirov/ScreenerPRO.git Screener
cd Screener

# 3. полная настройка: .env, install, prisma, ingest, dev
chmod +x run-dev-full.sh run-dev.sh sync.sh
./run-dev-full.sh
```

### Windows (PowerShell)

```powershell
# 1. установить Node LTS и pnpm
winget install OpenJS.NodeJS.LTS
npm install -g pnpm

# 2. склонировать
cd C:\
git clone https://github.com/kendirov/ScreenerPRO.git Screener
cd Screener

# 3. полная настройка
.\run-dev-full.cmd
```

После этого по адресу `http://localhost:3000/screener` поднимается dev-сервер.

---

## 3. Ежедневный рабочий цикл

### Сценарий: «работал на Windows → пересел за Mac»

**На Windows (перед уходом):**

```cmd
sync.cmd save
```

Скрипт:
1. Делает `git add -A` (все файлы, кроме `.gitignore`).
2. Создаёт commit с авто-сообщением `wip(<имя-машины>): <дата-время>`.
3. Тянет remote через `git pull --rebase --autostash` (на случай если параллельно что-то прилетело).
4. Делает `git push origin main`.

**На Mac (когда садишься):**

```bash
./sync.sh pull
```

Скрипт делает `git fetch` + `git pull --rebase --autostash` — твоя локальная копия становится точной копией удалённой.

Точно так же работает обратное направление (Mac → Windows).

---

## 4. Если есть локальные несохранённые правки

`sync.sh pull` и `sync.ps1 pull` оба используют **`--autostash`** — это значит:

- если на машине остались **несохранённые** изменения, git сам спрячет их в stash перед `pull` и автоматически восстановит после;
- если получился конфликт — git об этом скажет и оставит файлы в состоянии, готовом к ручному разрешению.

В этом случае:

```bash
# посмотреть, где конфликт
git status

# открыть файл, исправить блоки <<<<<<<, =======, >>>>>>>
git add <файлы>
git rebase --continue   # если шёл rebase
# либо
git stash pop           # если stash не применился чисто
```

После разрешения — снова `./sync.sh save`.

---

## 5. Что **не** синхронизируется автоматически (и это правильно)

В `.gitignore` помечены пути, которые **должны** жить локально и быть разными на разных машинах:

| Что | Почему |
|-----|--------|
| `frontend/.env` | секреты, локальные ключи (если появятся) |
| `frontend/prisma/prisma/dev.db` | локальная SQLite, заполняется через `pnpm -C frontend ingest:moex` |
| `node_modules/`, `.next/`, `dist/` | артефакты сборки, восстанавливаются `pnpm install` |
| `.DS_Store` (macOS) | служебный мусор Finder |
| `.vercel` | локальная привязка к Vercel |

`frontend/.env.example` коммитится — это шаблон, из которого `run-dev-full.*` собирает свой `.env`.

---

## 6. Что делать, если что-то пошло не так

| Симптом | Решение |
|---------|---------|
| `sync` падает на rebase с конфликтом | Открыть файлы → решить → `git add` → `git rebase --continue` → `./sync.sh save` |
| После `pull` Windows-скрипты «не запускаются»/ругаются на строки | `git ls-files --eol *.cmd *.ps1` — должно быть `crlf`. Если нет: `git add --renormalize . && ./sync.sh save` |
| `pnpm install` после `pull` ругается | Удалить `node_modules` и `pnpm-lock.yaml` НЕ нужно. Просто `pnpm install` ещё раз. |
| Prisma жалуется на отсутствие `dev.db` | `pnpm -C frontend prisma:push` (создаёт пустую базу), затем `pnpm -C frontend ingest:moex` |
| Сборка падает на Vercel | Локально проверить `pnpm -C frontend build` — он же запускается на Vercel |

---

## 7. Опционально: ветки под платформу

Если хочется параллельно править одно и то же место на двух машинах **без сшивки коммитов**:

```bash
# на Mac
git checkout -b mac/<имя-задачи>
# работаем, ./sync.sh save толкнёт mac/<имя-задачи> в remote

# на Windows
git fetch
git checkout mac/<имя-задачи>   # подхватили чужую WIP-ветку
# проверили / доделали
.\sync.ps1 save
```

Когда задача готова — `git checkout main && git merge mac/<имя-задачи>` локально или Pull Request на GitHub.

Но в большинстве случаев достаточно одной общей `main`-ветки и пары `save` / `pull`.

---

## 8. Чек-лист до commit/push

Перед `./sync.sh save` (особенно с фронтенд-правками):

1. `pnpm -C frontend build` — TypeScript и Next должны собраться.
2. `git status` — нет ли мусора (`.DS_Store`, дампов, личных заметок).
3. Если правка по правилам Cursor (`docs/CURSOR_WORKFLOW.md`) — обновлён ли `AI_SESSION_STATE.md`.
4. Commit-сообщение лучше дать осмысленное: `./sync.sh save "feat(screener): fix in-play scoring"` вместо авто-`wip(...)`.
