# ZigZag-lite — внутренний слой Round Levels

**ScreenerPRO · Strategy Lab · `/screener/strategies`**  
**Дата:** 2026-07-08  
**Код:** `frontend/lib/strategies/zigzag-lite-engine.ts`

Связанные документы: `docs/ROUND_LEVELS_STRATEGY.md`

---

## Зачем ZigZag-lite

Полноценная стратегия ZigZag — отдельная вкладка (позже). Сейчас **ZigZag-lite** — внутренний аналитический слой внутри «Круглых чисел»:

- локальные экстремумы (swing high / swing low);
- направление текущего движения;
- контекст подхода цены к круглому уровню;
- улучшение directional buffer zones.

---

## Modes

Selector **Экстремумы:**

- `Выкл`
- `Важные` (default)
- `Все`

## Detection v1

### Важные экстремумы

- fractal window: `left=5`, `right=5`
- `minMoveAbs >= bufferSize * 2`
- `minMovePct >= 0.35%`
- `minBarsBetweenPivots = 4`

### Все экстремумы

- fractal window: `left=3`, `right=3`
- `minMoveAbs >= bufferSize`
- `minMovePct >= 0.15%`

### Fractal pivot

- pivot **high** — `high[i]` максимален в окне;
- pivot **low** — `low[i]` минимален в окне;
- `confirmedAtIndex = i + right`.

**Фильтр шума** (zigzag-цепочка):

- чередование high/low;
- минимальный ход: `max(minMovePct × price / 100, minMoveAbs)`;
- для `important` pivot-ы дополнительно режутся по близости к предыдущему pivot (`minBarsBetweenPivots`).

**Лимит:** max **60** pivots (последние).

---

## Сегменты и направление

`ZigZagSegment`: от pivot A к pivot B.

| Поле | Описание |
|------|----------|
| `direction` | `up` если цена выросла, иначе `down` |
| `changePct` | % изменения |
| `bars` | свечей между pivots |

**Текущее движение** (`movementDirection`):

- последний pivot = **low** и `close` выше → **up**;
- последний pivot = **high** и `close` ниже → **down**;
- иначе **unknown**.

---

## Визуализация

**Код:** `strategy-zigzag-display.ts`, `strategy-candlestick-chart.tsx`

| Элемент | Стиль |
|---------|--------|
| swing high | marker **aboveBar**, `arrowDown`, текст `H <price>` |
| swing low | marker **belowBar**, `arrowUp`, текст `L <price>` |
| up segment | muted cyan/green line |
| down segment | muted red line |

Segment lines рисуются через **SVG overlay** (`timeToCoordinate` + `priceToCoordinate`), `pointer-events: none`, width `1`, opacity ~`0.45`.

### Labels

- только для режима **Важные**
- формат: `H 95.45`, `L 93.57`
- hard max labels: **80**

---

## Правая панель

Секция **«Экстремумы (ZigZag-lite)»**:

- **Последний экстремум** — тип (максимум/минимум), цена, время (MSK);
- **Текущее движение** — вверх / вниз / не определено;
- **До ближайшего круглого уровня** — расстояние в цене.

---

## Связь с directional buffers

Если ZigZag mode не `off`:

- `resolveActiveDirectionalBuffer` использует `zigzagMovementDirection`:
  - `up` → `up_to_level`;
  - `down` → `down_to_level`.

Кроме этого, active approach zones для Round Levels берут **zigzag segments** как источник swing-движений, а если segment-ов нет, включают fallback на direction runs по `close N bars`.

**Код:** `round-buffer-direction-engine.ts`

---

## API

```ts
computeZigZagLite(candles, options?): ZigZagLiteResult
inferZigZagMovementDirection(lastPivot, currentPrice): "up" | "down" | "unknown"
nearestRoundLevelDistance(currentPrice, levels): { level, distance } | null
buildZigZagChartMarkers(pivots, segments, candles): ZigZagChartMarker[]
```

---

## Verify

```bash
pnpm -C frontend verify:zigzag-lite
```

Кейсы: clear swings, noise filter, direction up/down, no NaN, sorted pivots, GAZP-like synthetic stats.

---

## Ограничения

- Не отдельная strategy tab;
- SVG overlay рисуется поверх canvas, поэтому визуальная читаемость зависит от opacity;
- labels ограничены hard-cap `80`;
- Fractal window выбирается режимом `important/all`, без ручной UI-настройки.
