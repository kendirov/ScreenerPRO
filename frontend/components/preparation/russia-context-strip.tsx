"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import { formatPct } from "@/lib/screener/formatters";
import { cn } from "@/lib/utils/cn";

function findRow(rows: ScreenerRow[], ticker: string): ScreenerRow | undefined {
  const key = ticker.toUpperCase();
  return rows.find((r) => r.ticker.toUpperCase() === key);
}

function pctClass(value: number | null | undefined): string {
  if (value == null) return "text-lab-text-dim";
  if (value > 0) return "text-emerald-300/90";
  if (value < 0) return "text-rose-300/90";
  return "text-lab-text-dim";
}

function ContextCell({
  label,
  ticker,
  changePct,
}: {
  label: string;
  ticker: string;
  changePct: number | null | undefined;
}) {
  return (
    <div className="min-w-0 rounded border border-white/[0.06] bg-slate-950/30 px-2 py-1.5">
      <p className="font-mono text-[8px] uppercase tracking-wide text-lab-text-dim">{label}</p>
      <p className="mt-0.5 truncate text-[10px] text-lab-text-main">{ticker}</p>
      <p className={cn("mt-0.5 font-mono text-[10px] tabular-nums", pctClass(changePct))}>
        {formatPct(changePct, 2)}
      </p>
    </div>
  );
}

export function RussiaContextStrip({ rows }: { rows: ScreenerRow[] }) {
  const imoex = findRow(rows, "IMOEX2") ?? findRow(rows, "IMOEX");
  const si = findRow(rows, "Si") ?? rows.find((r) => r.ticker.startsWith("Si"));
  const brent = findRow(rows, "BR") ?? rows.find((r) => r.ticker.startsWith("BR"));
  const cny = findRow(rows, "CNY") ?? rows.find((r) => r.ticker.startsWith("CNY"));

  const cells = [
    { label: "Индекс", ticker: imoex?.ticker ?? "IMOEX", changePct: imoex?.percentChange },
    { label: "Si", ticker: si?.ticker ?? "Si", changePct: si?.percentChange },
    { label: "Нефть", ticker: brent?.ticker ?? "BR", changePct: brent?.percentChange },
    { label: "CNY", ticker: cny?.ticker ?? "CNY", changePct: cny?.percentChange },
  ];

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {cells.map((cell) => (
        <ContextCell key={cell.label} {...cell} />
      ))}
    </div>
  );
}
