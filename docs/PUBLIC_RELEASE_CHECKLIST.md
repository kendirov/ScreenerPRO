# Чек-лист публичного релиза — Лаборатория рынка

Перед merge в `main` и production deploy.

---

## URL для проверки

| URL | Ожидание |
|-----|----------|
| `/` | Редирект на `/screener` |
| `/screener` | «Лаборатория рынка», KPI, акции в игре, фьючерсы в фокусе |
| `/screener/stocks` | Таблица акций, радар, пресеты, status strip |
| `/screener/futures` | Таблица/группы фьючерсов, пресеты |
| `/stocks/SBER` | Карточка акции (если есть данные) |
| `/futures/SiZ5` | Карточка фьючерса (тикер может отличаться) |

Скрытые, но должны открываться по прямой ссылке:

- `/materials`, `/academy`, `/lab/market-map`, `/sandbox`

---

## Функциональность

1. Бренд в UI: **«Лаборатория рынка»** (ScreenerPRO только технически в meta/repo)
2. В sidebar только **Рынок · Акции · Фьючерсы** (на production без `NEXT_PUBLIC_SHOW_DRAFT_NAV`)
3. Акции и фьючерсы загружаются (не «0» без объяснения)
4. Status strip: источник MOEX / DEMO / кэш, время обновления, рынок открыт/закрыт
5. Пресеты фильтров работают, показывают count
6. Клик по строке акций/фьючерсов → инспектор справа
7. Пустой HARD in-play в радаре — с понятным текстом, не как «сломано»
8. `pnpm -C frontend build` — exit 0

---

## Данные

### Live MOEX

- Status strip: **MOEX ISS**, не DEMO
- `/api/screener?assetClass=stock` → `status.source: "moex"`, `rows.length > 0` в торговую сессию
- `diagnostics.rowsBeforeFilter > 0`

### Fallback / DEMO

- `status.isDemo: true` или `status.staleCache: true`
- В UI явная пометка DEMO / кэш
- Не выдавать demo за live

### Признаки поломки

- «0 бумаг» без empty-state
- Вечная «Загрузка…» > 30 с
- HTTP 500 на `/api/screener`
- Таблица пустая при `stockRows > 0` в API (проверить фильтр «Скрыть неликвиды»)

---

## Диагностика

```bash
curl -s 'http://localhost:3000/api/screener?assetClass=stock' | jq '.status, .diagnostics'
curl -s 'http://localhost:3000/api/screener/health'
```

---

## Нельзя выпускать в main

- Login / Pricing / auth в публичной навигации
- Блок «Черновики» в sidebar на production
- Пустой скринер без объяснения при недоступном MOEX
- Фейковые котировки без пометки DEMO
- Сломанный build / TypeScript errors

---

## Статус релиза

Заполнить перед deploy:

- [ ] Ready / Needs fixes
- Критичные баги: …
- Некритичные улучшения: …
- Можно мержить в main: да / нет
