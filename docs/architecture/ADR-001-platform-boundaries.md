# ADR-001: границы ScreenerPRO и presentation-os

- Статус: принято для первой итерации.
- Дата: 2 августа 2026.
- Решение пересматривается после release manifest и auth spike.

## Контекст

ScreenerPRO — зрелое рыночное ядро с большим числом рабочих и экспериментальных маршрутов. presentation-os — отдельное контентное ядро Studio/Player с собственным стеком vinext, Supabase staging, RLS и моделью immutable releases.

В незакоммиченной ветке `feature/trading-os-platform` ScreenerPRO уже существует второй прототип courses/admin/Supabase. Он полезен как исследование, но пересекается с предметной моделью presentation-os и не имеет live RLS/Preview подтверждения.

## Варианты

### A. ScreenerPRO — основной продукт, presentation-os — модуль

Плюсы: единая точка входа; проще бренд и маршрутизация.

Минусы: при прямом переносе придётся мигрировать vinext/React Flow/content schema; высокий риск сломать рынок и потерять независимый release cycle.

### B. Monorepo

Плюсы: общий tooling и packages.

Минусы: не решает границы данных и auth; увеличивает blast radius CI/deploy; польза сейчас не доказана.

### C. Два приложения с контрактом

Плюсы: независимые deploy/recovery; ScreenerPRO не зависит от Studio; presentation-os сохраняет быстрые творческие итерации.

Минусы: потребуется согласованный SSO/entitlement и versioned API; визуальный язык может разойтись.

## Решение

Выбран C. ScreenerPRO становится основным Trading OS shell. presentation-os остаётся отдельным content runtime.

Первая интеграция:

- route `/studio` в ScreenerPRO;
- внешний base URL задаётся `NEXT_PUBLIC_PRESENTATION_OS_URL`;
- без URL показывается `Студия не подключена` и точные границы;
- нет iframe, общей cookie и runtime dependency;
- публикация и доступ не реализуются в этом срезе.

Следующая интеграция:

- immutable release manifest;
- server-side cache в ScreenerPRO;
- signed deep links для invite-only Player;
- отдельный ADR по identity/SSO.

## Последствия

Положительные:

- рыночное ядро можно развивать независимо;
- Studio можно переделывать без миграции ScreenerPRO;
- публичные материалы отделены от private Draft;
- можно удалить слабый эксперимент без потери stable release.

Стоимость:

- два build/deploy pipeline;
- нужен contract testing;
- общая дизайн-система пока синхронизируется документом/tokens, а не package import;
- route-level UX должен честно объяснять переход между приложениями.

## Отложенные решения

- единый Supabase project или внешний identity broker;
- custom domain/subdomains;
- entitlement storage;
- public market data inside Player;
- общий telemetry pipeline;
- monorepo после появления минимум трёх реально общих packages.

## Проверка решения

ADR считается жизнеспособным, если:

- `/studio` не ломает build без env;
- с configured URL переход открывает правильный Studio;
- ScreenerPRO работает при недоступном presentation-os;
- public Player может индексироваться отдельно, Studio — нет;
- release manifest не содержит private Draft/source payload;
- auth spike доказывает owner/student isolation до production.
