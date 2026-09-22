# START_HERE_FOR_AI — ScreenerPRO

Первая точка входа для ChatGPT, Cursor и других AI-ассистентов. Читай этот файл, затем углубляйся по ссылкам ниже.

---

## Что читать первым

1. **`PRODUCT_VISION.md`** — зачем существует продукт и какой UX/вау-эффект нужен.
2. **`PROJECT_CONTEXT.md`** — техническая архитектура, маршруты, API, источники данных.
3. **`AI_SESSION_STATE.md`** — текущее состояние последней итерации.
4. **`docs/CHATGPT_PROMPT_GUIDE.md`** — **для ChatGPT**: как продумывать логику, чек-листы и готовые шаблоны промптов для Cursor (с учётом текущей итерации).
5. **`docs/CURSOR_WORKFLOW.md`** — правила работы Cursor.
6. **`docs/INTRADAY_SCREENER_TERMINAL_VISION.md`** — **продуктовая доктрина** intraday decision terminal: North Star, сценарий трейдера, блоки (Market Pulse, In Play, Situation, Table, Inspector), UI direction, антипаттерны. **Обязательно** для продуктовых и UX-задач по скринеру.
7. **`docs/UI_NUMBERS_MINIMALISM.md`** — стандарт «минимализм цифр» в UI (новые экраны и правки таблиц/карточек).
8. **`docs/MARKET_RADAR_FORMULAS.md`** — **источник истины** по формулам Market Radar (Vol x, In Play, Active, Shots, baseline); читать перед правкой порогов и объяснением «В игре» ученикам.
9. **`docs/DESIGN_FOUNDATION_AND_NAVIGATION.md`** — токены, shell и правила навигации; читать перед UX-правками.

---

## Роли

| Участник | Роль |
|----------|------|
| **Пользователь** | Владелец продукта и трейдерская логика |
| **ChatGPT** | Продуктовый, аналитический и UX-напарник; готовит промпты для Cursor |
| **Cursor** | Исполнитель изменений в коде |

---

## Главная идея продукта

**ScreenerPRO** — интерактивный трейдерский терминал и обучающая платформа по **MOEX**.

**Ядро** — скринер акций и фьючерсов: активность, ликвидность, спред, оборот, in-play, торговые ситуации.

**Материалы** и **Академия** — интерактивные, визуальные и современные, **не** статичные статьи.

Данные сейчас в основном из **MOEX ISS** (бесплатно) + локальные расчёты; при сбое — fallback/mock. Платный MOEX API — в планах.

---

## Перед любой задачей

AI должен:

1. Прочитать **`AI_SESSION_STATE.md`**.
2. При необходимости свериться с **`PROJECT_CONTEXT.md`**.
3. Если задача продуктовая или UX — свериться с **`PRODUCT_VISION.md`** и **`docs/INTRADAY_SCREENER_TERMINAL_VISION.md`** (для скринера и терминала).
4. **Не менять код** без понимания, что именно хочет пользователь.
5. После изменений **обновить `AI_SESSION_STATE.md`** (крупные итерации — по `docs/CURSOR_WORKFLOW.md`).

---

## Что важно не сломать

- `/screener`
- `/screener/stocks`
- `/screener/futures`
- `/materials/technical-characteristics`
- MOEX ISS live/fallback
- `ValueWithStatus` в технических характеристиках
- sidebar/layout
- build перед деплоем (`pnpm -C frontend build`)

---

## Формат отчёта Cursor после задачи

Cursor **всегда** пишет:

- **что изменил** — простыми словами (что увидит пользователь);
- **какие файлы** изменил;
- **какие команды** запускал;
- **прошёл ли build**;
- **что проверить в браузере** (URL + действия);
- **обновлён ли** `AI_SESSION_STATE.md`.

Подробный шаблон — в **`docs/CURSOR_WORKFLOW.md`**.

---

## Быстрый старт локально

```bash
pnpm install
pnpm -C frontend dev
```

→ http://localhost:3000/screener  

Полная настройка:
- **Windows:** `run-dev-full.cmd`
- **macOS / Linux:** `./run-dev-full.sh`
- Подробности — `PROJECT_CONTEXT.md` §11.

## Работа на двух машинах (Win + Mac)

| Машина | Начало сессии | Конец сессии | Аварийная остановка |
|--------|---------------|--------------|---------------------|
| **Windows** | `sync.cmd pull` | `sync.cmd save` | `stop.cmd` |
| **macOS** | `./sync.sh pull` | `./sync.sh save` | `./stop.sh` |

Точки отката (любая машина):

```
./checkpoint.sh "label"   # запомнить
./restore.sh              # показать список
./restore.sh <tag|hash>   # откатить
```

- **Для не-программиста, как организовать день:** `docs/WORKFLOW.md` ← начинай отсюда.
- **Глубокий разбор git-синхронизации:** `docs/CROSS_PLATFORM_SYNC.md`.
