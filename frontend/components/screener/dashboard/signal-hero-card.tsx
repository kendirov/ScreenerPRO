"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import { MarketFocusCard } from "@/components/screener/market-focus-card";
import { screenerRowToStockCard } from "@/lib/domain/market-card-visual";

interface SignalHeroCardProps {
  row: ScreenerRow | null;
  sparklineValues?: number[] | null;
}

export function SignalHeroCard({ row, sparklineValues }: SignalHeroCardProps) {
  if (!row) {
    return (
      <MarketFocusCard
        size="hero"
        type="stock"
        ticker="—"
        changePct={null}
        empty
        eyebrow="Главный сигнал"
        emptyTitle="Явного лидера нет"
        emptyDescription="Нет акций «в игре» с выраженным оборотом и импульсом."
      />
    );
  }

  const props = screenerRowToStockCard(row, "hero");
  return (
    <MarketFocusCard
      {...props}
      eyebrow="Главный сигнал"
      sparklineValues={sparklineValues}
    />
  );
}
