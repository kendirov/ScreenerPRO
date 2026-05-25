"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import { MarketFocusCard } from "@/components/screener/market-focus-card";
import { screenerRowToFutureCard } from "@/lib/domain/market-card-visual";

interface FutureFocusHeroCardProps {
  row: ScreenerRow | null;
  baseLabel: string;
  sparklineValues?: number[] | null;
}

export function FutureFocusHeroCard({ row, baseLabel, sparklineValues }: FutureFocusHeroCardProps) {
  if (!row) {
    return (
      <MarketFocusCard
        size="hero"
        type="future"
        ticker="—"
        changePct={null}
        empty
        eyebrow="Фьючерс в фокусе"
        emptyTitle="Нет данных по фьючерсам"
      />
    );
  }

  const props = screenerRowToFutureCard(row, "hero", baseLabel);
  return (
    <MarketFocusCard
      {...props}
      eyebrow="Фьючерс в фокусе"
      sparklineValues={sparklineValues}
    />
  );
}
