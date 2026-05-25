import type { ScreenerRow } from "@screenerpro/shared";
import type { StatusChipTone } from "@/components/ui/metrics-minimalism";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";
import { getStockTableStatus, isStockInPlay, type StockTableStatus } from "@/lib/domain/stock-screener-display";
import { computeRelativeTurnover } from "@/lib/domain/stocks-screener-signals";

export type StockMomentBadge = {
  label: string;
  tone: StatusChipTone;
};

const STATUS_MOMENT: Partial<
  Record<StockTableStatus, { label: string; tone: StatusChipTone; weight: number }>
> = {
  Ликвид: { label: "ликвидность", tone: "live", weight: 55 },
  "В игре": { label: "в игре", tone: "cyan", weight: 92 },
  Импульс: { label: "импульс", tone: "amber", weight: 82 },
  Давление: { label: "давление", tone: "rose", weight: 82 },
  "Тонкий разгон": { label: "тонкий разгон", tone: "warn", weight: 78 },
};

/** До 3 moment badges для hover-card — только из реальных метрик строки. */
export function buildStockRowMomentBadges(row: ScreenerRow, maxTurnover: number): StockMomentBadge[] {
  const candidates: { label: string; tone: StatusChipTone; weight: number }[] = [];
  const status = getStockTableStatus(row, maxTurnover);
  const fromStatus = STATUS_MOMENT[status];
  if (fromStatus) candidates.push(fromStatus);

  const position = computePositionInRange(row.lastPrice, row.low, row.high);
  if (position != null && position >= 0.72) {
    candidates.push({ label: "у high", tone: "live", weight: 74 });
  } else if (position != null && position <= 0.28) {
    candidates.push({ label: "у low", tone: "rose", weight: 74 });
  }

  const relative = computeRelativeTurnover(row);
  if (relative != null && relative >= 1.15) {
    candidates.push({ label: "сильнее рынка", tone: "cyan", weight: 68 });
  } else if (relative != null && relative <= 0.85) {
    candidates.push({ label: "слабее рынка", tone: "muted", weight: 62 });
  }

  if (isStockInPlay(row) && status !== "В игре") {
    candidates.push({ label: "в игре", tone: "cyan", weight: 90 });
  }

  const seen = new Set<string>();
  return candidates
    .sort((a, b) => b.weight - a.weight)
    .filter(({ label }) => {
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    })
    .slice(0, 3)
    .map(({ label, tone }) => ({ label, tone }));
}
