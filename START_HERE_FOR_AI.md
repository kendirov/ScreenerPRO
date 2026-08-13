# START_HERE_FOR_AI — ScreenerPRO

Первая точка входа для AI. Перед кодом прочитать:

1. `AI_SESSION_STATE.md`
2. `docs/SCREENEROS_SOURCE_OF_TRUTH.md`
3. `docs/TRADING_OS_ARCHITECTURE.md`
4. `docs/STOCKS_CORE_VERTICAL_SLICE.md`
5. `docs/DATA_CONTRACTS.md`
6. `docs/MARKET_RADAR_FORMULAS.md` перед изменением формул.

## Канон

ScreenerPRO — market terminal для intraday-трейдера: данные → отбор → объяснение → подготовка решения. Knowledge/Training и Presentation OS не встраиваются в runtime ScreenerPRO; интеграция — versioned links/manifests.

## Безопасность

Не хранить секреты в Git, Drive, issue, chat или браузере. Не менять production напрямую. Не считать fixture/fallback live. Не выводить значения ключей в отчёте. P0-ротация описана в `docs/SECURITY_ROTATION_PLAN.md`.

## Рабочий цикл

Feature/codex branch → targeted checks → build → draft PR → Preview → desktop/mobile browser QA → merge. После каждой крупной итерации обновлять `AI_SESSION_STATE.md`.

## Стабильные маршруты

`/screener`, `/screener/stocks`, `/screener/futures`, `/materials/technical-characteristics`. Не менять их market logic без отдельного решения.

## Отчёт

Файлы, проверки, build, browser QA, data limitations, незакрытые риски и обновлённый state.
