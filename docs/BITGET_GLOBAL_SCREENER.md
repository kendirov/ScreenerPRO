# Bitget Global Screener

## Задача

ScreenerPRO получает отдельный Bitget-контур из двух связанных рабочих экранов:

- `/screener/bitget` — скринер полного подключённого universe;
- `/screener/bitget/map` — интерактивная карта механики рынков и продуктов.

Карта и скринер работают как единая система: сначала трейдер понимает, **что именно он торгует**, затем переходит к нужной группе инструментов и отбору.

## Принцип карты

Карта построена по Presentation Blueprint проекта: объект → устройство → механика → источник движения → риск → действие.

В центре не меню Bitget, а вопрос трейдера: **какая механика сделки стоит за выбранным тикером?**

Три мира:

1. **Крипто**
   - crypto spot — сам токен;
   - margin — spot + заём;
   - crypto futures — производный контракт, long/short, OI; funding у perpetual, expiry у delivery.

2. **Акции / ETF**
   - базовый U.S. stock/ETF underlying;
   - Stock+ — broker-style доступ к реальным акциям/ETF через securities-партнёров;
   - rToken — токенизированная фондовая экспозиция Reality;
   - stock perpetual — бессрочный дериватив, без владения акцией;
   - U.S. options — underlying → expiry → strike → call/put.

3. **Глобальные рынки**
   - внешний commodity/FX/index market как источник цены;
   - commodity perpetuals;
   - TradFi / Forex / indices / CFD как отдельный data-контур.

Линии на карте показывают реальную связь продукта с базовым рынком и всегда заканчиваются в узле. Hover подсвечивает маршрут, click фиксирует продукт и раскрывает его анатомию.

## Статусы данных

Карта не изображает отсутствие adapter-а как нулевые данные.

**Уже подключены к public screener:**

- CRYPTO_SPOT;
- MARGIN;
- CRYPTO_FUTURES;
- RTOKEN_SPOT;
- STOCK_PERPS;
- COMMODITY_PERPS.

**Отдельные adapters следующего слоя:**

- Stock+;
- U.S. option chains;
- TradFi / CFD.

Для подключённых групп карта показывает live count и крупнейшие текущие представители по 24h turnover. Для неподключённых групп отображается честный pending-status.

## Один тикер — разные сделки

Для фондовой ветви карта содержит отдельный интерактивный rail:

`US Stock / ETF → Stock+ | rToken | Stock Perp | Options`

Это ключевой учебный объект. Одинаковый underlying не означает одинаковые права, funding, expiry, торговое время или риск.

## Источник данных скринера

Публичный Bitget UTA v3:

- `GET /api/v3/market/instruments` для `SPOT`, `MARGIN`, `USDT-FUTURES`, `USDC-FUTURES`, `COIN-FUTURES`;
- `GET /api/v3/market/tickers` для spot и futures-категорий;
- margin использует соответствующий spot ticker, если символ совпадает.

Серверный адаптер: `frontend/lib/server/services/bitget-market.ts`.

Клиент никогда не получает API Secret или Passphrase.

## Terminal v3

Основной `/screener/bitget` содержит:

- единый вертикальный scroll страницы;
- быстрый briefing strip: лидеры роста/падения, оборот, funding;
- фильтры по market groups;
- цена, 24h, cached 7d, 24h range, turnover, spread, funding, focus;
- rToken как отдельный `R` marker + привычный underlying ticker;
- null funding сортируется после реальных значений;
- click по ticker копирует TradingView-friendly symbol;
- click по строке раскрывает inline workspace;
- TradingView Advanced Chart, параметры контракта, favorite и заметка;
- favorites/notes сохраняются локально в браузере.

## Attention Score

Score не прогнозирует направление. Он объединяет наблюдаемые признаки текущей активности:

- абсолютное 24h движение;
- ширину 24h диапазона;
- percentile оборота;
- качество spread;
- экстремальный funding как дополнительный фактор.

`В игре` требует достаточный score и минимум один признак участия/движения.

## Безопасность

- торговых POST-запросов нет;
- Secret/Passphrase не попадают в браузер или GitHub;
- Stock+/private adapters проектируются server-only;
- никакие отсутствующие market-data не заменяются fake/mock числами.

## Следующие слои

1. Signed Stock+ adapter: static securities + quotes + market status.
2. Options adapter: underlyings + expiries + full option chains.
3. TradFi adapter.
4. Historical feature cache: RSI/ATR/relative activity/multi-timeframe momentum.
5. Private Classic v2 account analytics как отдельная поверхность, не смешанная с public market adapter.
6. Cloud workspace для watchlist, notes и briefing history.
