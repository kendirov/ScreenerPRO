# WEEKLY_INFLATION_LAB — черновик «Инфляционная лаборатория»

Маршрут: **`/lab/weekly-inflation`**

Статус: **DRAFT · LAB · рабочий черновик с загрузкой данных (2026-05-25)**

---

## Цель страницы

Макро-дашборд для **недельной инфляции РФ** перед брифингом и разбором рынка MOEX.

**Важно:** страница **не подставляет фейковые ряды**. Цифры — только из вашего импорта или распознанного CSV по URL.

---

## Три режима загрузки

| Режим | Статус | Как работает |
|-------|--------|--------------|
| **1. Ручной CSV** | ✅ работает | Textarea, drag/drop `.csv`, «Загрузить CSV» → `localStorage` |
| **2. Official URL** | ✅ работает | Ссылка на публикацию Росстат/ЕМИСС для сверки перед эфиром |
| **3. Росстат / Fedstat** | 🧪 эксперимент | `GET /api/lab/weekly-inflation/fetch` — безопасная загрузка URL, ограниченный парсинг CSV |

---

## Источники данных (UI)

| Источник | Роль | Статус |
|----------|------|--------|
| **Ручной CSV** | источник цифры | connected |
| **Official URL** | проверка / сверка | connected |
| **Росстат / Fedstat** | источник цифры (эксп.) | experimental |
| **Smart-Lab Calendar** | источник календаря | planned — не цифра |
| **Минэкономразвития** | комментарий | planned — не основной ряд |

В блоке «Источник данных» показываются:

- **Источник цифры**
- **Источник календаря**
- **Статус**
- **Последнее обновление**
- **Проверено вручную / не проверено**

---

## Блок «Где взять данные»

Glass-панель сразу под KPI / empty state — объясняет, откуда брать цифры:

| Карточка | Статус в UI | Действия |
|----------|-------------|----------|
| **Росстат / ЕМИСС** | основной официальный источник · авто — эксперимент | «Вставить официальный URL», «Загрузить CSV» |
| **Manual CSV** | работает сейчас | «Скачать шаблон», «Импортировать CSV» |
| **Smart-Lab** | календарь / события | ссылка на `/lab/preparation`; **не** источник цифры |
| **Минэкономразвития** | обзор / комментарий | без действий — не заменяет ряд |

Рядом — **быстрый ввод одной недели** (период, headline %, YTD %, URL, «Добавить»).

Ниже — **таблица последних 10 недель**: период · неделя % · 4w avg · annualized · источник · проверка · удалить.

Полный CSV-импорт и Official URL — в collapsible «Загрузка данных».

---

## Формат CSV

```csv
periodStart,periodEnd,publishedAt,headlinePct,ytdPct,foodPct,nonFoodPct,servicesPct,fruitVegPct,fuelPct,sourceUrl,note
```

- `headlinePct` — обязательно (%)
- даты — ISO `YYYY-MM-DD`
- пример в UI помечен: **«Это пример формата, не реальные данные.»**

Поддерживается legacy: `weekEndDate,weeklyInflationPct`

### Ошибки импорта

- нет `headlinePct`
- неверная дата
- дубликат периода
- пустой CSV
- неправильный разделитель (`,` · `;` · tab)

---

## Official URL (localStorage)

Ключ: **`screenerpro.weekly-inflation.official-publication`**

Поля:

- URL публикации
- название источника
- дата публикации
- флаг «Проверено вручную»

Смысл: даже при ручном вводе цифр рядом хранится ссылка для быстрой проверки перед брифингом.

---

## Experimental fetch API

`GET /api/lab/weekly-inflation/fetch?source=rosstat|fedstat&url=&indicatorId=`

Ответ:

```typescript
type WeeklyInflationFetchResponse = {
  source: "rosstat" | "fedstat"
  status: "ok" | "not-configured" | "unsupported" | "error"
  updatedAt: string
  points: WeeklyInflationPoint[]
  diagnostics: {
    url?: string
    contentType?: string
    parsedPoints: number
    warnings: string[]
  }
}
```

Логика:

- без `url` и без env → `not-configured`
- безопасная загрузка (timeout, лимит размера, блок localhost)
- CSV → попытка `parseWeeklyInflationCsv`
- HTML / XLSX → diagnostics + warning, без агрессивного парсинга
- `indicatorId` не хардкодится — только hint в warnings

Env (опционально):

- `WEEKLY_INFLATION_ROSSTAT_INDICATOR_URL` / `_ID`
- `WEEKLY_INFLATION_FEDSTAT_INDICATOR_URL` / `_ID`

---

## localStorage ключи

| Ключ | Содержимое |
|------|------------|
| `screenerpro.weekly-inflation.manual` | массив `WeeklyInflationPoint[]` |
| `screenerpro.weekly-inflation.official-publication` | метаданные Official URL |

---

## UI после импорта

- KPI пересчитываются
- графики строятся при наличии данных
- бейдж **«ручные данные»** в header
- предупреждение «Сверьте с официальным источником»

---

## Связь с подготовкой

- `/lab/preparation` — карточка **«Недельная инфляция»**
- Shared: `lib/domain/weekly-inflation-storage.ts`, hook `useWeeklyInflationBrief()`
- **Порядок эфира**: «Инфляция / ставка» после «Контекст»
- **Telegram summary**: строка инфляции при наличии данных
- без данных: «данные не загружены»

---

## Файлы

| Путь | Роль |
|------|------|
| `lib/domain/weekly-inflation.ts` | типы, CSV, localStorage |
| `lib/domain/weekly-inflation-sources.ts` | адаптеры, fetch types |
| `lib/server/services/weekly-inflation-sources.ts` | safe remote fetch |
| `app/api/lab/weekly-inflation/fetch/route.ts` | experimental endpoint |
| `components/lab/weekly-inflation/inflation-data-sources-guide.tsx` | «Где взять данные» |
| `components/lab/weekly-inflation/inflation-quick-week-form.tsx` | быстрый ввод недели |
| `components/lab/weekly-inflation/inflation-recent-weeks-table.tsx` | таблица 10 недель |
| `components/lab/weekly-inflation/inflation-manual-import.tsx` | CSV импорт |
| `components/lab/weekly-inflation/inflation-official-publication.tsx` | Official URL |
| `components/lab/weekly-inflation/inflation-source-status.tsx` | источники + проверка |

---

## Promotion

После стабилизации официального API — перенос в `/materials` и автозагрузка при валидном indicator id.
