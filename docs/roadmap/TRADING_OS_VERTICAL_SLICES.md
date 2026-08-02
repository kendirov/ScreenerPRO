# Trading OS — вертикальные срезы

Принцип: каждый срез заканчивается пользовательским действием, проверяемым URL и честным статусом данных.

## VS-01. Trading OS shell

Статус: `текущая итерация`.

Результат: семь разделов, desktop/mobile navigation, contextual market links, Studio bridge, честные WIP states.

Не входит: auth, публикация, перенос данных, новые формулы.

## VS-02. Relative Activity v1 — 20 акций

Статус: `следующий приоритет`.

### Пользовательский результат

На `/screener/stocks` трейдер видит короткий список `В игре`, три главных числа и объяснение причины отбора. Клик открывает inspector.

### Universe

- 20 ликвидных TQBR акций;
- стартовый список versioned в коде;
- пересмотр по rolling 20-session turnover/trades;
- исключение остановленных торгов и ненадёжных строк;
- universe version видна в diagnostics.

### Метрики

```text
Relative turnover = current cumulative turnover / median cumulative turnover
                    at the same MSK bucket over prior sessions

Relative trades = current cumulative trades / median cumulative trades
                  at the same MSK bucket over prior sessions

Impulse = price return over 5/15m + range expansion + position in range
```

Same-time bucket: 10 минут для v1. Требование baseline: минимум 10 валидных сессий; целевое окно 20.

### Честность Trades x

Текущий MOEX candle baseline не гарантирует историческое число сделок. Поэтому:

1. сохранять cumulative `NUMTRADES` snapshot для universe каждые 10 минут;
2. строить baseline только после достаточного числа сессий;
3. до этого `Trades x = —`, status `baseline missing/partial`;
4. не подменять Trades x абсолютным NUMTRADES или turnover rank.

### Отбор `В игре`

Минимальные gate:

- tradable + liquid;
- reliable turnover baseline или top turnover rank fallback с явной причиной;
- impulse/structure, а не одна активность;
- finite metrics; no NaN/Infinity;
- максимум 5 строк на первом экране.

Reason examples:

- `Оборот x2.4 · импульс +1.1% за 15м`;
- `Сделки x1.8 · удерживает high`;
- `Baseline сделок ещё накапливается`.

### Acceptance

- ровно 20 бумаг в configured universe;
- relative turnover воспроизводим на fixture;
- Trades x не появляется без reliable baseline;
- reason строится из тех же полей, что score;
- inspector показывает source, observedAt и baseline sessions;
- существующий Market Radar не меняется в этом срезе;
- typecheck, targeted lint, unit verify, build, desktop/mobile QA.

## VS-03. Studio release catalog

Read-only список active releases presentation-os в разделе `Студия/Знания`. Только immutable Release, без Draft. Contract test обеих сторон.

## VS-04. Owner Studio access

Единый owner login flow или подтверждённый SSO. Threat model, MFA, server authorization, RLS readback. Без production до двух-role test.

## VS-05. Invite-only Player

Курс/урок выдаётся пользователю по entitlement. Expiry, revoke, audit, signed URL. Public и invite release разделены.

## VS-06. News → reaction

Пять компаний, 10–20 источников, три месяца. Дедупликация, сущности, reaction windows 1/5/15/30/60, manual review. Важность определяется реакцией, не LLM-оценкой.

## VS-07. AlgoPack adapter

Provider contract, entitlement health, delay/license metadata, feature flag. До credentials состояние `не подключено`; платные данные не смешиваются с free ISS без source label.

## VS-08. Knowledge graph bridge

Drive source → Capture → KnowledgeBlock → Topic → Lesson. Parent/readback для Drive, immutable source snapshot, explicit evidence status.

## VS-09. Session Memory

Сравнение `сейчас / 20 / 40 / 60 минут назад` для выбранного universe. Persisted feature snapshots, session boundaries, no cross-day leakage.

## VS-10. Production hardening

Lint debt program, route ownership, error budgets, contract tests, backup/restore drill, dependency audit, visual regression, production runbook.
