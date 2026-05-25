# PREPARATION_DRAFT — черновик «Подготовка»

Маршрут: **`/lab/preparation`**

Статус: **черновик · ЛАБ · компактный пульт (polish 2026-05-25)**

---

## Цель страницы

Рабочий пульт подготовки к **утреннему** и **недельному** трейдерскому брифингу по MOEX.

Не финальный материал для публикации — инструмент для сбора контекста перед эфиром и коротким постом в Telegram.

---

## Структура страницы (первый экран)

| Блок | Содержимое |
|------|------------|
| **Фокус брифинга** | До 8 пунктов (scoring без AI): события · драйверы · инструменты · «Собрать порядок эфира» |
| **Что важно** | Консоль: ближайшие события · активные драйверы · что открыть · порядок эфира |
| **Источник** | Переключатель Ручные / Smart-Lab / Все |
| **Фокус-инструменты** (accordion, открыт) | Строки с 1д · 5д · оборотом — не сетка карточек |

### Свернуто по умолчанию

- Подробный календарь + доска драйверов
- Все инструменты (полный watchlist)
- Ручной импорт
- Источники и диагностика
- Черновик текста (outline + Telegram)

---

## Что уже работает

- **Режимы День / Неделя** — фильтры событий.
- **MOEX ISS** через `/api/screener` — котировки, in-play, резолв тикеров.
- **5-дневные свечи** через `/api/lab/preparation/candles` — только реальные серии; метки «Последняя свеча», «Данных сегодня нет».
- **Smart-Lab** (эксп.) через `/api/lab/preparation/smartlab-calendar` — серверный импорт, кэш ~45 мин, бейдж источника.
- **Фокус брифинга** — `preparation-focus-score.ts`, без AI и без торговых рекомендаций.
- **Драйверы** — учебная модель (компактно на первом экране + полная доска в accordion).
- **Ручной импорт** — форма события + неразобранные заметки.
- **Порядок эфира** — из выбранных событий/инструментов + кнопка из фокуса.
- **Черновик + Telegram** — статические шаблоны, копирование.

---

## Что пока вручную

- События без Smart-Lab — форма «Ручной импорт».
- Драйверы — учебная модель, не live-новости.
- Новости и макро — paste в заметки / шаблоны.
- Внешний фон — «внешний источник не подключён».
- Выбор «Добавить в эфир» — только в сессии (без persist).

---

## Smart-Lab — ограничения

- Regex-парсинг открытых страниц; при смене HTML → error, страница не падает.
- Только серверный fetch; без клиентского scraping.
- Impact не завышается автоматически (дивиденды/отчёты = medium, ЦБ/макро = high).
- **Демо-события (ставка ЦБ и т.п.) убраны с экрана** — не смешиваются с Smart-Lab.

---

## Что подключать позже

| Источник | План |
|----------|------|
| **Investing / TE** | Официальный календарь |
| **БКС / Финам** | Обзоры — API или ручной перенос |
| **Persist** | localStorage / backend для manualEvents и выбора |
| **Promotion** | Из «Черновики» в основное меню |

---

## Как использовать перед брифингом

1. Откройте **`/lab/preparation`**, выберите **День** или **Неделя**.
2. Проверьте **Фокус брифинга** и нажмите «Собрать порядок эфира из фокуса» при необходимости.
3. В **Что важно** — события Smart-Lab, драйверы, что открыть, порядок эфира.
4. Добавьте пропущенное через **Ручной импорт** (accordion).
5. Перед эфиром — **Черновик текста** для копирования.

---

## Ограничения (важно)

1. **Не показывать фейковые рыночные данные как реальные.**
2. **Драйверы** — учебная модель, помечено на UI.
3. **Генерация текста ИИ** — не реализована.
4. **Не ломать** `/screener`, `/materials`, `/lab/market-map`, `/lab/orderflow-simulator`.

---

## Empty states

| Ситуация | Текст |
|----------|-------|
| Нет свечей | «Данных сегодня нет» / «Последняя свеча DD.MM» |
| Smart-Lab недоступен | «Smart-Lab недоступен — добавьте события вручную» |
| Фокус пуст | «Недостаточно данных. Используем ручной список подготовки.» |
| Внешние инструменты | «внешний источник не подключён» |

---

## Ключевые файлы

```
frontend/app/(app)/lab/preparation/page.tsx
frontend/app/api/lab/preparation/candles/route.ts
frontend/app/api/lab/preparation/smartlab-calendar/route.ts
frontend/components/lab/preparation/
  preparation-page.tsx
  preparation-briefing-focus.tsx
  preparation-console.tsx
  preparation-drivers-compact.tsx
  preparation-events-timeline.tsx
  preparation-inplay-strip.tsx
  preparation-air-order-compact.tsx
  preparation-collapsible-section.tsx
  preparation-instruments-panel.tsx
  event-radar.tsx
  driver-board.tsx
  manual-event-import.tsx
frontend/lib/domain/
  preparation-focus-score.ts
  smartlab-calendar.ts
  market-data-status.ts
  preparation-events.ts
  preparation-watchlist.ts
  preparation-briefing-outline.ts
frontend/lib/server/services/smartlab-calendar.ts
```

Legacy (не на странице): `instrument-watch-grid.tsx`, `market-context-board.tsx`, `preparation-priority-rail.tsx`.

---

## Promotion (когда будет готов)

1. Перенести из `sidebarDraftsNav` в витрину материалов.
2. Persist выбора и ручных событий.
3. Стабильный календарь (не regex).
4. Обновить `PROJECT_CONTEXT.md` и `AI_SESSION_STATE.md`.
