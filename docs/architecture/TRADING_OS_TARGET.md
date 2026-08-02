# Trading OS — целевая архитектура

Статус: `рабочая целевая модель`; необратимых миграций нет.

## Контексты платформы

```text
ScreenerPRO
  Shell / Market / Research / News reaction / Diagnostics
  MOEX ISS adapters / screeners / strategies

presentation-os
  Private Studio / Knowledge graph / Lesson Builder
  Immutable Revision / Release / Public Player

Google Drive
  Author source / files / PPTX / transcripts / canonical navigation

Identity and access (future boundary)
  owner / student / invited viewer / public
```

## Ответственность приложений

### ScreenerPRO

- единая навигация Trading OS;
- live/near-live рынок и source health;
- скринеры акций и фьючерсов;
- Strategy Lab и market research;
- событийная реакция, когда данные подтверждены;
- gateway к Studio, Knowledge и Management;
- public/free market surface.

### presentation-os

- Capture и Inbox;
- KnowledgeBlock и explicit relations;
- Board, Runbook и Lesson Builder;
- Draft → Checkpoint → Review → Validation → Revision → Release;
- public Player и access-controlled Player;
- source metadata и авторские материалы;
- не получает live market feed автоматически.

## Связь между приложениями

### Этап 1 — реализованная граница

```text
ScreenerPRO /studio
  -> configured presentation-os URL
  -> или честное состояние «не подключено»
```

Контракт: `NEXT_PUBLIC_PRESENTATION_OS_URL`. Значение — public base URL без секретов. Cookie, localStorage и внутренние Supabase payload между приложениями не разделяются.

### Этап 2 — release manifest

presentation-os отдаёт server-side read-only manifest:

```json
{
  "schemaVersion": 1,
  "releaseId": "rel_...",
  "slug": "risk-management",
  "title": "Риск-менеджмент",
  "visibility": "public",
  "publishedAt": "...",
  "playerUrl": "https://.../p/risk-management",
  "sourceStatus": "verified"
}
```

ScreenerPRO хранит только cache/index этого manifest и ссылку на Player. Draft и private source payload не копируются.

### Этап 3 — доступ по приглашению

- identity provider выбирается отдельным ADR;
- ScreenerPRO проверяет продуктовый entitlement server-side;
- presentation-os проверяет viewer entitlement server-side;
- short-lived signed access заменяет постоянные share tokens;
- доступ, отзыв и публикация пишутся в audit log.

## Данные рынка

```text
Provider adapter
  instrument metadata
  market snapshot
  candles
  trades aggregate
  orderbook (optional/licensed)
  open interest (optional)
  news/events
  health + delay + license
```

Режим: `free-first, paid-ready`.

- MOEX ISS остаётся первым адаптером.
- AlgoPack подключается отдельным адаптером и флагом.
- отсутствие entitlement не вызывает mock-live.
- у каждого payload: source, observedAt, delay, quality, license mode.

## Поверхности доступа

| Поверхность | Содержимое | Модель доступа |
|---|---|---|
| Public | бесплатный скринер, public Players | без приватных данных |
| Owner | Studio, черновики, источники, управление | сильная auth + server authorization |
| Invite | выбранные курсы/уроки/releases | entitlement + expiry |
| Student | программа, задания, прогресс | scoped RLS |

## Нефункциональные требования

- desktop-first terminal; mobile — обзор, обучение и уведомления;
- p95 shell navigation без полной перезагрузки;
- data status виден на каждом decision screen;
- no secrets in public env;
- semantic tokens shared как пакет только после стабилизации Visual DNA;
- screeners не зависят от доступности Studio;
- Studio не зависит от live MOEX для открытия Draft;
- отказ одного приложения не ломает другое.

## Observability

Минимальный health contract:

```text
service
version/commit
status: healthy | degraded | offline
source
observedAt
latencyMs
fallbackReason
```

Клиент показывает `degraded/offline`, но не раскрывает секреты и внутренние stack traces.

## Запрещённые связи

- iframe Studio внутри ScreenerPRO в первой версии;
- чтение private Supabase таблиц presentation-os из browser ScreenerPRO;
- общий mutable `status` вместо Draft/Revision/Release;
- прямой импорт React components из соседнего repository;
- cross-app cookie sharing без отдельной threat model;
- big-bang перенос Prisma/SQLite в новую БД.
