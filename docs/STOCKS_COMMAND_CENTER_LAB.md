# Stocks Command Center Lab

Маршрут: `/lab/stocks-command-center`. Это изолированный эксперимент; `/screener` и `/screener/stocks` не меняются.

## Честный контракт v0

Есть: live MOEX snapshot всего universe, цена, изменение дня, high/low, оборот, число сделок, дневной диапазон, IMOEX и intraday baseline там, где он доступен.

Нет: стакан, bid/ask depth, агрессор, лента сделок, крупные принты, устойчивые 5/15/60m returns и candle quality для всех бумаг. Эти показатели не подменяются нулями и не называются order-flow.

## Score

`InPlay Relative = Activity 28% + Participation 20% + Range 14% + Momentum 14% + Relative strength 12% + snapshot quality 12% − risk 22%`.

Это экспериментальная сортировка snapshot, а не торговый сигнал и не оценка edge. `Activity` использует percentile оборота и честный Vol x; `Participation` — percentile сделок; `Relative strength` — изменение акции минус IMOEX. `Тонкий прострел` требует сильного движения при низком percentile оборота или сделок.

`?labDebug=1` открывает причины выбранной строки. В v1 блоки и режим сохраняются локально в браузере. Candle/order-book слой — следующий отдельный пакет с durable snapshots, а не batch-запросы MOEX при render.
