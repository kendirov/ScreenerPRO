# MAC_CLEANUP — почему «тупит» запуск сайта и как всё почистить

Для трейдера, без программирования. Прочитай **раздел 1–3**, потом выбери уровень очистки в **раздел 4**.

---

## 1. Почему переустановка Cursor не помогла

Cursor — это только редактор. Тормоза и **kernel panic** идут от:

| Причина | Почему Cursor тут ни при чём |
|---------|------------------------------|
| **Next.js dev-сервер** | Отдельные процессы `node` / `next-server`, не внутри Cursor |
| **Память 16 GB** | Cursor + dev + браузер + macOS > 16 GB → swap → freeze |
| **Кэши npm/pnpm** | Лежат в `~/.npm`, `~/Library/pnpm`, не в приложении Cursor |
| **Сироты после закрытия терминала** | `next-server` остаётся жить, Cursor переустановкой не убивается |

Переустановка Cursor **не трогает** `~/Library/Application Support/Cursor` полностью, если не удалить папку вручную — и главное, **не освобождает RAM** от Node.

---

## 2. Что у тебя реально установлено (диагностика)

На Mac сейчас **не бардак из 10 Node** — установка относительно чистая:

| Что | Где | Размер / версия |
|-----|-----|-----------------|
| Node.js | Homebrew (`/opt/homebrew`) | v24.8.0 |
| pnpm | Homebrew | 10.32.1 |
| Проект ScreenerPRO | `~/Pro/Screener` | `node_modules` ~776 MB, `.next` ~425 MB |
| Кэш npm | `~/.npm` | ~3 GB |
| Кэш pnpm | `~/Library/pnpm` | ~667 MB |
| Docker Desktop | установлен, **сейчас не запущен** | данные ~3 GB на диске |
| nvm / fnm | **нет** | хорошо |

**Вывод:** «тупит запуск сайта» — это в основном:

1. **Первый запуск после долгого перерыва** — Next компилирует сотни файлов (1–3 минуты нормально).
2. **Turbopack / много workers** — мы переключили `./run-dev.sh` на **webpack (`dev:stable`)** — медленнее старт, но меньше RAM.
3. **Мало свободной RAM** — Mac начинает swap → всё «вязкое», иногда panic.
4. **Node 24** — очень новый; для Next иногда стабильнее **Node 22 LTS** (см. раздел 6).

---

## 3. Что НЕ нужно удалять для работы с ScreenerPRO

| Оставить | Зачем |
|----------|--------|
| **Cursor** | правки кода, чат с агентом |
| **Git** (обычно с Xcode / brew) | `./sync.sh save` |
| **Репозиторий** `~/Pro/Screener` | сам проект |
| **Node + pnpm** | только если хочешь `localhost:3000` на Mac |

| Можно не ставить заново | Зачем |
|-------------------------|--------|
| Локальный dev | смотри **screenerpro.vercel.app** после `./sync.sh save` |
| Docker | для ScreenerPRO не нужен |
| VS Code, Warp | дубли Cursor |
| Несколько версий Python/rust/llvm | не для этого проекта (если сам не пользуешься) |

---

## 4. Три уровня очистки (скрипт в репозитории)

Из папки проекта:

```bash
cd ~/Pro/Screener
chmod +x scripts/mac-dev-cleanup.sh   # один раз
```

### Уровень A — `light` (безопасно, начни с этого)

```bash
./scripts/mac-dev-cleanup.sh light
```

- Останавливает dev (`stop.sh`)
- Чистит кэши npm/pnpm (~3–4 GB)
- **Не удаляет** Node и не трогает зависимости проекта

### Уровень B — `project` (если сайт странно себя ведёт)

```bash
./scripts/mac-dev-cleanup.sh project
```

- Всё из `light`
- Удаляет `node_modules` и `.next`, ставит зависимости заново
- Первый `./run-dev.sh` после этого снова будет **долгим** — это норма

### Уровень C — `full` (снести Node с Mac полностью)

```bash
./scripts/mac-dev-cleanup.sh full
```

- Спросит подтверждение `yes`
- Удалит Homebrew `node`, кэши, артефакты проекта
- После этого **локальный** `./run-dev.sh` не работает, пока не поставишь Node снова (инструкция в конце скрипта)
- **Работа через Vercel + Cursor без dev — возможна**

---

## 5. Ручная уборка (то, что скрипт не трогает)

### Docker Desktop (если не пользуешься)

1. Docker → Settings → снять **Start at login**
2. Quit Docker
3. При желании удалить приложение и данные:
   - Перетащить Docker в Корзину
   - `rm -rf ~/Library/Containers/com.docker.docker` (~3 GB)

### Cursor (полный сброс кэша редактора, не переустановка .app)

1. Закрыть Cursor
2. Удалить только кэш (настройки частично сохранятся):
   ```bash
   rm -rf ~/Library/Application\ Support/Cursor/Cache
   rm -rf ~/Library/Application\ Support/Cursor/CachedData
   rm -rf ~/Library/Application\ Support/Cursor/Code\ Cache
   ```
3. Открыть Cursor снова

### macOS «Хранилище»

**Системные настройки → Основные → Хранилище** — рекомендации Apple (кэши, корзина). У тебя `~/Library/Caches` может быть **10+ GB** — это ускоряет систему в целом.

### Downloads

Удалить старые `.dmg` / `.pkg` (Barrier, VPN, установщики) — место на диске, не RAM, но при 37% занятом диске swap тоже страдает.

---

## 6. Рекомендуемый «лёгкий» стек после полной чистки

Если после `full` хочешь снова local dev — **Node 22 LTS**, не 24:

```bash
brew install node@22
brew link --overwrite --force node@22
corepack enable
corepack prepare pnpm@10.32.1 --activate

cd ~/Pro/Screener
./scripts/mac-dev-cleanup.sh project
./run-dev.sh
```

---

## 7. Как работать без local dev (Mac почти не грузится)

1. Cursor на Mac — правки, промпты, скриншоты (`Cmd+Ctrl+Shift+4` → `Cmd+V`)
2. `./sync.sh save` — на GitHub
3. Смотреть на Windows / телефоне: **https://screenerpro.vercel.app**
4. `./stop.sh` — если случайно запустил dev

Так Mac **не должен** уходить в panic из‑за Next.

---

## 8. Перед каждым запуском сайта на Mac

```bash
cd ~/Pro/Screener
./stop.sh
./run-dev.sh
```

Один терминал. Не открывать второй `pnpm dev`.

Подробнее про panic: `docs/MAC_MEMORY.md`  
Про Win + Mac workflow: `docs/WORKFLOW.md`
