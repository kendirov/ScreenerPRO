# Design Foundation + Navigation Shell

## Правило визуала

Матовый graphite/navy canvas, различие поверхностей только в 2–5% lightness. Cyan — данные, blue — выбор, green/red — подтверждённый поток и риск, amber — внимание, violet — исследования и стратегии. В viewport максимум две glow-зоны; обычные числа не светятся.

## Tokens

Источник истины — `frontend/app/globals.css`: canvas/surface/border/text, шесть semantic accents, spacing, radius, motion, focus and z-layers. `lab-*` остаются aliases для постепенной миграции без поломки существующих экранов. Рыночные числа используют `lab-number` и tabular-nums.

## Navigation

Desktop: Главная, Акции, Фьючерсы, Стратегии, Связи, Академия; тихий footer: Черновики, AI Data только при `NEXT_PUBLIC_AI_DATA_AVAILABLE=true`. Mobile: четыре основных destinations и `Ещё`; у него Связи, Академия, Черновики. Draft list раскрывается только с `NEXT_PUBLIC_SHOW_DRAFT_NAV=true`.

## Contracts

`PageHeader`, `StatusStrip`, `SectionFrame`, `NavBadge`, `DataState` — компактные primitives. Не надо заменять все cards: новые и затронутые страницы используют их постепенно.

## Accessibility and performance

Visible focus ring, semantic text alongside color, touch targets 44px, safe-area bottom nav, `prefers-reduced-motion`. Shell не делает market queries; CSS-first, без новой UI/animation библиотеки. Mobile primary nav максимум пять пунктов.

## Следующие пакеты

1. Перенести headers/status strips на screener workspaces.
2. Fixed tables/inspector для акций и фьючерсов.
3. Command Center после стабилизации этих workspaces.
