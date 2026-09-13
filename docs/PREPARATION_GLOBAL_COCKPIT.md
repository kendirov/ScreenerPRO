# Подготовка Global Market Cockpit

Статус: Preview READY, 2026-09-13. Production не изменён.

Preview: https://screenerpro-rknwx7zqr-artem-kendirovs-projects.vercel.app/trading/preparation

## Архитектура

`/trading/preparation` использует существующий `TradingShell` и единый слой данных страницы. Верхняя briefing-сцена выбирает anchors и explainable anomalies из того же массива, который строит Full Market Map.

Поток: instrument registry или живой MOEX universe → provider adapter → нормализованная quote/futures family → quality state → anomaly evidence → briefing и full map.

## Источники

| Контур | Источник | Состояние | Ограничение |
|---|---|---|---|
| Акции, индексы, FX и futures РФ | MOEX ISS через существующий `/api/screener` | LIVE/CLOSED/STALE/FALLBACK по payload | Состояние зависит от сессии; demo всегда FALLBACK |
| Current/next, DTE, OI split, roll | MOEX instrument master + `futures-family.ts` | как у MOEX payload | Basis не показывается без совместимого spot timestamp |
| Мировые индексы, FX, commodities | Yahoo Finance chart adapter | DELAYED/CLOSED/STALE | Не биржевой low-latency feed; daily 1M history |
| Macro/rates | не подключён | UNKNOWN | Ничего не имитируется |
| Weekend proxy | не активирован | отсутствует | Нужен отдельный instrument discovery; official/proxy серии не смешиваются |

Секреты не требуются. UI не вызывает vendor API напрямую.

## Anomaly engine

`explainAnomaly` учитывает абсолютное движение, движение к собственной реализованной волатильности, 5D move, относительный оборот/сделки, range expansion, roll share и DTE. Priority используется для сортировки; пользователю показываются 1–4 причины, а не непрозрачный score.

## Аудит старого Lab

| Часть | Решение |
|---|---|
| Внешний Yahoo adapter/registry | ADAPT — сохранён server-side, расширен полным нормализованным universe |
| MOEX candles и текущий screener | KEEP — используется существующий pipeline |
| Briefing focus | ADAPT — заменён на explainable cross-market promotion |
| Events/manual import/air order | KEEP для следующего слоя — существующая логика не удалена |
| Учебные driver models | REPLACE — не перенесены как market truth |
| Source diagnostics | ADAPT — компактный Sources & Data Health |
| Telegram draft | KEEP в Lab — вне первого production slice |

## Компоненты

- Route: `frontend/app/(trading)/trading/preparation/page.tsx`
- UI: `frontend/components/trading/trading-preparation.tsx`
- Domain: `frontend/lib/domain/preparation-market.ts`
- Global adapter: `frontend/lib/server/services/external-market-provider.ts`
- Global registry/scanner: `frontend/lib/server/services/external-assets-registry.ts`, `external-market-scanner.ts`
- Styles: `frontend/app/(trading)/trading/trading.css`
- Contract verification: `frontend/scripts/verify-trading-preparation.ts`

## QA

Unit contract, TypeScript, targeted ESLint и production build проходят. Локальный browser QA подтвердил реальные payloads, навигацию, source badges, Freeze, dark/light и 0 console errors. Vercel build завершён со статусом READY; защищённый Preview прошёл authenticated HTTP readback, но визуальный remote QA требует браузерную Vercel-сессию. Full lint: исторический baseline 73 errors и 141 warnings вне нового scope.
