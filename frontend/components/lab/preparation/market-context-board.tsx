"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import { Globe2 } from "lucide-react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import {
  BLUE_CHIP_TICKERS,
  COMMODITY_FUTURE_PREFIXES,
  CURRENCY_FUTURE_PREFIXES,
  type BriefingMode,
} from "@/components/lab/preparation/preparation-types";
import { cn } from "@/lib/utils/cn";

type ContextSlice = {
  id: string;
  title: string;
  rows: ScreenerRow[];
};

export function MarketContextBoard({
  mode,
  rows,
  hasLiveData,
  className,
}: {
  mode: BriefingMode;
  rows: ScreenerRow[];
  hasLiveData: boolean;
  className?: string;
}) {
  const slices = hasLiveData ? buildContextSlices(rows) : [];

  const sections: { id: string; title: string; hint: string; slice?: ContextSlice }[] = [
    {
      id: "external",
      title: "Внешний фон",
      hint: mode === "day" ? "Азия / US close / сырьё на открытие" : "Недельный макро-контекст",
    },
    {
      id: "commodities",
      title: "Товары",
      hint: "Нефть, металлы, газ — фьючерсы FORTS",
      slice: slices.find((s) => s.id === "commodities"),
    },
    {
      id: "currency",
      title: "Валюта",
      hint: "Si · CNY · ED — связка с акциями",
      slice: slices.find((s) => s.id === "currency"),
    },
    {
      id: "index",
      title: "Индекс",
      hint: "IMOEX / RTS — состав и поводыри",
    },
    {
      id: "bluechips",
      title: "Голубые фишки",
      hint: "Ликвидные TQBR-лидеры",
      slice: slices.find((s) => s.id === "bluechips"),
    },
    {
      id: "sectors",
      title: "Сектора",
      hint: "Где деньги внутри акций",
    },
  ];

  return (
    <section className={cn("lab-glass-panel relative overflow-hidden p-3", className)}>
      <LabSectionHeading className="mb-1 flex items-center gap-1.5 text-lab-cyan/90">
        <Globe2 className="h-3.5 w-3.5" />
        Контекст рынка
      </LabSectionHeading>
      <p className="text-[11px] text-lab-muted">
        {mode === "day"
          ? "Сводка по сегментам перед открытием — только живые данные MOEX."
          : "Недельный срез: товары, валюта, лидеры и секторы за 5 торговых дней."}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {sections.map((section) => (
          <ContextSection key={section.id} section={section} hasLiveData={hasLiveData} />
        ))}
      </div>
    </section>
  );
}

function ContextSection({
  section,
  hasLiveData,
}: {
  section: { id: string; title: string; hint: string; slice?: ContextSlice };
  hasLiveData: boolean;
}) {
  const rows = section.slice?.rows ?? [];

  return (
    <div className="lab-glass-card border border-lab-cyan/15 bg-gradient-to-br from-lab-cyan/4 via-transparent to-lab-violet/4 px-2.5 py-2">
      <p className="text-[11px] font-medium text-lab-text">{section.title}</p>
      <p className="mt-0.5 text-[10px] text-lab-dim">{section.hint}</p>

      {!hasLiveData ? (
        <p className="mt-2 text-[11px] text-lab-muted">— нет данных MOEX</p>
      ) : rows.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {rows.slice(0, 4).map((row) => (
            <li key={row.ticker} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-mono text-lab-text">{row.ticker}</span>
              <ChangeBadge value={row.percentChange} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-lab-muted">— блок не заполнен</p>
      )}
    </div>
  );
}

function ChangeBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="font-mono text-lab-dim">—</span>;
  }
  const tone = value > 0 ? "text-lab-green" : value < 0 ? "text-lab-red" : "text-lab-muted";
  return (
    <span className={cn("font-mono tabular-nums", tone)}>
      {value > 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

function buildContextSlices(rows: ScreenerRow[]): ContextSlice[] {
  const futures = rows.filter((row) => row.assetClass === "future");
  const stocks = rows.filter((row) => row.assetClass === "stock");

  const commodities = futures
    .filter((row) => COMMODITY_FUTURE_PREFIXES.some((p) => row.ticker.startsWith(p)))
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0));

  const currency = futures
    .filter((row) => CURRENCY_FUTURE_PREFIXES.some((p) => row.ticker.startsWith(p)))
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0));

  const bluechips = stocks
    .filter((row) => BLUE_CHIP_TICKERS.includes(row.ticker as (typeof BLUE_CHIP_TICKERS)[number]))
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0));

  return [
    { id: "commodities", title: "Товары", rows: commodities },
    { id: "currency", title: "Валюта", rows: currency },
    { id: "bluechips", title: "Голубые фишки", rows: bluechips },
  ];
}
