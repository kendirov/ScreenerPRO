# WEEKLY_INFLATION_LAB — «Инфляционная лаборатория»

Маршрут: **`/lab/weekly-inflation`**

Статус: **DRAFT · LAB · premium macro-lab UX (2026-05-25)**

---

## Цель страницы

**Макро-лаборатория ставки** — недельная инфляция РФ для брифинга: темп, 4w импульс, годовой темп, отклонение от цели ЦБ 4%, рыночный режим.

**Принцип:** без фейковых рядов. Графики и интерпретация — только после ручного ввода или реального источника.

---

## Первый экран (2026-05-25)

| Блок | Содержание |
|------|------------|
| **Header** | «Инфляционная лаборатория» · описание · бейджи ЧЕРНОВИК, LAB, источник, ЦБ 4% |
| **KPI strip** | Последняя неделя · 4w импульс · Годовой из недели · Годовой из 4w · Отклонение от 4% |
| **Hero** | Empty state + 3 кнопки **или** главный график (столбцы + 4w avg + подсветка последней недели) |
| **Quick Add** | «Добавить последнюю неделю» — период, %, YTD, URL, «Добавить» |
| **Где взять данные** | 4 glass-карточки: Росстат/ЕМИСС · Manual CSV · Минэкономразвития · Smart-Lab |
| **Связь с брифингом** | Как данные попадут на `/lab/preparation` |

---

## Quick Add

Поля:

- период с / период по
- недельная инфляция %
- с начала года %
- ссылка на источник
- кнопка «Добавить»

→ `localStorage` + event `weekly-inflation-updated` → KPI, графики, preparation.

---

## Расширенный импорт (accordion, свёрнут)

**«Расширенный импорт CSV»** — по умолчанию закрыт:

- Official URL (метаданные публикации)
- Полный CSV (textarea, drag/drop, шаблон)

**«Статус источников»** — эксперимент Росстат/Fedstat fetch.

---

## Источники данных (4 карточки)

| Карточка | Роль | Статус в UI |
|----------|------|-------------|
| **Росстат / ЕМИСС** | основной официальный источник | официальный · ручная проверка |
| **Manual CSV** | работает сейчас | подключено |
| **Минэкономразвития** | комментарий и обзор | справочно — не заменяет ряд |
| **Smart-Lab** | календарь событий | не источник цифры → `/lab/preparation` |

---

## Графики (только при данных)

- Hero: недельные столбцы + линия 4w avg
- Annualized vs 4%
- Heatmap недель
- Категории (если поля food/nonFood/services в CSV)

Без данных — **декоративные графики не рисуются**.

---

## «Что это значит для рынка»

Карточки: ОФЗ · Банки · Рубль/Si · Строители · Индекс · Дивидендные акции.

Формат: режим · чувствительность · что смотреть · тикеры.

Без торговых рекомендаций. При отсутствии данных — нейтральные placeholder-карточки.

---

## Связь с подготовкой

- `/lab/preparation` — карточка «Недельная инфляция»
- Shared: `lib/domain/weekly-inflation-storage.ts`, `useWeeklyInflationBrief()`
- Порядок эфира: «Инфляция / ставка» после «Контекст»
- Telegram summary при наличии данных

---

## Формат CSV

```csv
periodStart,periodEnd,publishedAt,headlinePct,ytdPct,foodPct,nonFoodPct,servicesPct,fruitVegPct,fuelPct,sourceUrl,note
```

Пример в UI: **«Это пример формата, не реальные данные.»**

---

## localStorage ключи

| Ключ | Содержимое |
|------|------------|
| `screenerpro.weekly-inflation.manual` | `WeeklyInflationPoint[]` |
| `screenerpro.weekly-inflation.official-publication` | метаданные Official URL |

---

## Файлы

| Путь | Роль |
|------|------|
| `components/lab/weekly-inflation/weekly-inflation-page.tsx` | оркестрация страницы |
| `inflation-hero-panel.tsx` | hero empty / chart |
| `inflation-kpi-strip.tsx` | 5 KPI |
| `inflation-quick-week-form.tsx` | quick add |
| `inflation-data-sources-guide.tsx` | 4 source cards |
| `inflation-briefing-bridge.tsx` | связь с preparation |
| `inflation-market-impact.tsx` | рыночная интерпретация |
| `inflation-manual-import.tsx` | CSV в accordion |
| `inflation-trend-chart.tsx` | hero + embedded chart |
| `lib/domain/weekly-inflation.ts` | типы, CSV, расчёты |
| `lib/domain/weekly-inflation-storage.ts` | storage + brief |

---

## Promotion

После стабилизации официального API — перенос в `/materials`.
