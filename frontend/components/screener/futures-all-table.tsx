"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ScreenerRow } from "@screenerpro/shared";
import { ScreenerTable } from "@/components/screener/screener-table";
import { buildFuturesFamilies } from "@/lib/domain/futures-family";
import { tradingFormat } from "@/lib/formatters/trading";

function dte(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null;
  const exp = new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) return null;
  const diff = Math.ceil((exp.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return Number.isFinite(diff) ? diff : null;
}

function compactRub(value: number | null): string {
  return tradingFormat.formatTurnoverRub(value).replace(/\s?₽/g, "");
}

function curveLabel(value: "contango" | "backwardation" | "flat"): string {
  if (value === "contango") return "Contango";
  if (value === "backwardation") return "Backwardation";
  return "Flat";
}

export function FuturesAllTable({ rows }: { rows: ScreenerRow[] }) {
  const families = React.useMemo(() => buildFuturesFamilies(rows), [rows]);
  const metaByTicker = React.useMemo(() => {
    const map = new Map<string, { base: string; shape: "contango" | "backwardation" | "flat"; spread: number | null }>();
    for (const family of families) {
      for (const item of family.contracts) {
        map.set(item.ticker, {
          base: family.familyLabel,
          shape: family.curve.curveShape,
          spread: family.curve.frontNextSpread,
        });
      }
    }
    return map;
  }, [families]);

  const columns = React.useMemo<ColumnDef<ScreenerRow>[]>(() => [
    {
      accessorKey: "ticker",
      header: "Контракт",
      cell: ({ row }) => <span className="font-semibold text-white">{row.original.ticker}</span>,
    },
    {
      id: "base",
      header: "База",
      accessorFn: (row) => metaByTicker.get(row.ticker)?.base ?? "—",
      cell: ({ row }) => <span>{metaByTicker.get(row.original.ticker)?.base ?? "—"}</span>,
    },
    { accessorKey: "lastPrice", header: "Цена", cell: ({ getValue }) => <span className="font-mono">{tradingFormat.formatDynamicPrice(getValue<number | null>())}</span> },
    { accessorKey: "percentChange", header: "%", cell: ({ getValue }) => <span className="font-mono">{tradingFormat.formatSignedPercent(getValue<number | null>())}</span> },
    { accessorKey: "turnover", header: "Оборот", cell: ({ getValue }) => <span className="font-mono">{compactRub(getValue<number | null>())}</span> },
    { accessorKey: "openInterest", header: "ОИ", cell: ({ getValue }) => <span className="font-mono">{tradingFormat.formatInteger(getValue<number | null>())}</span> },
    { accessorKey: "metrics.dayRangePct", header: "Диапазон %", cell: ({ row }) => <span className="font-mono">{tradingFormat.formatSignedPercent(row.original.metrics.dayRangePct)}</span> },
    { id: "dte", header: "DTE", accessorFn: (row) => dte(row.expiryDate), cell: ({ row }) => <span className="font-mono">{dte(row.original.expiryDate) ?? "—"}</span> },
    {
      id: "shape",
      header: "Форма",
      accessorFn: (row) => metaByTicker.get(row.ticker)?.shape ?? "flat",
      cell: ({ row }) => <span>{curveLabel(metaByTicker.get(row.original.ticker)?.shape ?? "flat")}</span>,
    },
    {
      id: "spread",
      header: "Спред к след.",
      accessorFn: (row) => metaByTicker.get(row.ticker)?.spread ?? Number.NEGATIVE_INFINITY,
      cell: ({ row }) => {
        const value = metaByTicker.get(row.original.ticker)?.spread ?? null;
        return <span className="font-mono">{typeof value === "number" ? tradingFormat.formatSignedPercent(value) : "—"}</span>;
      },
    },
  ], [metaByTicker]);

  return <ScreenerTable rows={rows} columns={columns} emptyTitle="Нет доступных фьючерсов" emptyText="По текущему фильтру ничего не найдено." />;
}
