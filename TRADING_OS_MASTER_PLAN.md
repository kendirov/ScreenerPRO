# Trading OS — мастер-план

Статус: `подтверждено аудитом`, первая итерация 2 августа 2026.

## 1. Цель

Trading OS — единое русскоязычное рабочее пространство внутридневного трейдера MOEX и автора учебных материалов. Пользователь должен за 10–30 секунд понять, где сейчас деньги и движение, а затем без смены логики продукта перейти к исследованию, уроку или публикации.

Первый пользовательский результат: единый каркас с разделами `Сегодня`, `Рынок`, `Лаборатория`, `Новости`, `Студия`, `Знания`, `Управление`. Каркас не подменяет готовность функций: черновики и внешние контуры помечаются явно.

## 2. Источники истины

- `подтверждено`: рыночный код, формулы и маршруты — `kendirov/ScreenerPRO`.
- `подтверждено`: Studio/Player, контентный граф и immutable releases — `kendirov/presentation-os`.
- `подтверждено`: требования, авторские материалы и история продукта — Google Drive `Мой диск/Трейдинг`.
- `подтверждено`: live/near-live рынок — MOEX ISS через существующие сервисы ScreenerPRO.
- `нужно проверить`: production Auth/RLS, общая identity-модель и права публичного распространения отдельных наборов данных.

## 3. Baseline

- Ветка: `codex/trading-os-shell-v1`.
- База: `670eebf` (`feature/stocks-command-center-lab`).
- Tag: `checkpoint/trading-os-shell-v1-before-2026-08-02`.
- TypeScript: пройден.
- Production build baseline: пройден, 64 страницы; после добавления `/studio` — 65 страниц.
- Ключевые verify: navigation, Market Radar, Situation Engine, Stocks Command Center — пройдены.
- Полный lint: baseline не чистый — 73 ошибки и 144 предупреждения вне текущего среза.
- Browser QA: 10 ключевых маршрутов открываются без error boundary; desktop console чистая. Mobile `390×844` проверен отдельно: три главных раздела, `Ещё`, четыре дополнительных раздела и честные статусы видны; console чистая.

## 4. Карта существующих возможностей

| Контур | Что уже есть | Статус |
|---|---|---|
| Скринер | Акции, фьючерсы, Market Radar, In Play, fallback MOEX | `подтверждено` |
| Strategy Lab | Round Levels, свечи, batch snapshot, диагностика | `подтверждено` |
| Лаборатории | Карта рынка, валютные связи, корреляции, ЦБ, новости, подготовка, orderflow simulator | `подтверждено`; зрелость неоднородна |
| Stocks Command Center | Изолированный эксперимент на одном live snapshot | `подтверждено` |
| Обучение в ScreenerPRO | Незакоммиченный прототип courses/admin/Supabase | `прототип`; не включён в эту ветку |
| Studio/Player | Capture, KnowledgeBlock, Topic, Lesson, Revision/Release, public Player | `подтверждено` в presentation-os |
| Google Drive | Канонические материалы, навигация, заметки, PPTX, подготовка | `подтверждено` |
| Общая авторизация | Две разные реализации и два жизненных цикла | `не готово` |

## 5. Дубли и конфликтующие реализации

1. `ScreenerPRO feature/trading-os-platform` и `presentation-os` оба моделируют курсы, уроки, доступы и Supabase. Смешивание создаст две модели Lesson/Release и две миграционные истории.
2. В ScreenerPRO существуют два MOEX HTTP-клиента и два рыночных потока: live ISS и Prisma ingest.
3. Навигация смешивает продуктовые разделы, рыночные экраны и каталог лабораторий; первый экран desktop по умолчанию скрывает подписи в свернутом sidebar.
4. `Materials`, `Academy`, Drive-материалы и Knowledge OS частично отвечают на один вопрос «где знания», но имеют разный уровень готовности.
5. В presentation-os одновременно существуют legacy content-as-code и versioned Knowledge OS; текущий web repository сохраняет атомарный JSONB envelope при наличии нормализованных таблиц.
6. На Google Drive есть два одноимённых каталога `02_Контент курсов`; автоматическое объединение запрещено.

## 6. Главные риски

- `высокий`: ложное объединение репозиториев и схем до стабилизации контрактов.
- `высокий`: выдача demo/fallback за live, особенно для Trades x, стакана, ленты и агрессора.
- `высокий`: общая авторизация без доказанного RLS и server-side authorization.
- `средний`: full lint debt скрывает новые ошибки; нужен diff-scoped lint плюс отдельная программа очистки.
- `средний`: SQLite/Prisma не является production-хранилищем Vercel.
- `средний`: Studio bridge без configured URL может выглядеть как готовая интеграция — поэтому требуется честное состояние.
- `средний`: публикация рыночных данных может упираться в лицензионные права; публичный Player не должен автоматически получать live market payload.

## 7. Целевая информационная архитектура

| Раздел | Главный вопрос | Текущий маршрут |
|---|---|---|
| Сегодня | Что смотреть прямо сейчас? | `/screener` |
| Рынок | Какие инструменты ликвидны и активны? | `/screener/stocks` + контекстные вкладки |
| Лаборатория | Что исследовать глубже? | `/relationships` |
| Новости | Что произошло и как рынок отреагировал? | `/lab/event-reactions` (`черновик`) |
| Студия | Что создать, проверить и выпустить? | `/studio` (`bridge`) |
| Знания | Какие материалы, правила и уроки уже есть? | `/materials` |
| Управление | Данные, интеграции, доступы и диагностика | `/app/settings` (`в разработке`) |

## 8. Принятое решение

Выбран вариант C с поэтапным движением к A:

- ScreenerPRO — основной Trading OS shell и рыночное приложение.
- presentation-os — отдельный content runtime для Studio/Player.
- первая связь — versioned URL/deep-link contract через `NEXT_PUBLIC_PRESENTATION_OS_URL`;
- следующая связь — read-only manifest активных releases;
- общая identity и private access — отдельный вертикальный срез после выбора auth boundary;
- monorepo не создаётся.

Полное обоснование: `docs/architecture/ADR-001-platform-boundaries.md`.

## 9. Команды проекта

```bash
pnpm install --frozen-lockfile
pnpm -C frontend dev:live
pnpm -C frontend exec tsc --noEmit
pnpm -C frontend lint
pnpm -C frontend verify:navigation-design
pnpm -C frontend verify:market-radar
pnpm -C frontend verify:situation-engine
pnpm -C frontend verify:stocks-command-center
pnpm -C frontend build
```

## 10. Границы

Всегда:

- сохранять существующие screener routes и fallback;
- показывать источник, свежесть и статус данных;
- использовать русский язык в UI;
- отделять подтверждённое, гипотезу, черновик и недоступное поле;
- проверять desktop/mobile и console errors.

Сначала согласовать:

- платный источник или рост постоянной стоимости;
- общую identity-модель двух приложений;
- изменение лицензии/публичной ретрансляции данных;
- перенос таблиц или объединение репозиториев;
- production deployment.

Никогда:

- не выдумывать Trades x, стакан, ленту, агрессора и исторические baseline;
- не хранить service role или платные credentials в client env;
- не публиковать Draft вместо immutable Release;
- не менять формулы Market Radar в UI-срезе.

## 11. Критерии готовности первой итерации

- семь разделов видны и понятны на desktop/mobile;
- labels desktop sidebar видны по умолчанию, пользователь может свернуть его;
- market subnavigation сохраняет доступ к акциям, фьючерсам и стратегиям;
- Studio показывает подключённый URL или честное `не подключено`;
- Новости и Управление не притворяются готовыми;
- новые route/config файлы проходят targeted lint, typecheck и verify;
- полный build проходит;
- ключевые страницы проверены в браузере без console errors;
- `AI_SESSION_STATE.md` обновлён;
- следующий срез Relative Activity v1 имеет измеримый data contract.

## 12. Следующий сильный шаг

Relative Activity v1 для 20 ликвидных акций: same-time относительный оборот, честный статус Trades x, импульс, `В игре`, inspector и объяснимые причины. До накопления baseline сделок поле Trades x остаётся `—`.
