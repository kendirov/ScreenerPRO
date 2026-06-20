"use client";

import * as React from "react";
import type { CbrRateEvent } from "@/lib/cbr/cbr-rate-events";
import {
  buildDataIntegrityView,
  CBR_EVENT_INTEGRITY_LABELS,
  CBR_INSTRUMENT_INTEGRITY_LABELS,
  instrumentsDataFromChartSlots,
  type CbrDataIntegrityView,
} from "@/lib/cbr/cbr-data-integrity";
import type { CbrReactionChartGridModel } from "@/lib/domain/cbr-rate-chart-model";
import { cn } from "@/lib/utils/cn";

export function CbrDataIntegrityStrip({
  event,
  chartModel,
  loading,
}: {
  event: CbrRateEvent;
  chartModel: CbrReactionChartGridModel | null;
  loading?: boolean;
}) {
  const view = React.useMemo(() => {
    const instruments = loading
      ? []
      : instrumentsDataFromChartSlots(chartModel?.slots);
    return buildDataIntegrityView(event, instruments);
  }, [event, chartModel, loading]);

  return (
    <div className="rounded-md border border-lab-border/40 bg-lab-bg-deep/40 px-2.5 py-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <EventBadge badge={view.eventBadge} />
        <span className="text-[10px] leading-snug text-lab-muted">{view.caption}</span>
        {loading ? (
          <span className="ml-auto text-[9px] text-lab-dim">загрузка графиков…</span>
        ) : view.instruments.length > 0 ? (
          <InstrumentRow instruments={view.instruments} className="ml-auto" />
        ) : null}
      </div>
    </div>
  );
}

export function CbrDataIntegrityDetails({ view }: { view: CbrDataIntegrityView }) {
  return (
    <div className="grid gap-2 text-[10px] sm:grid-cols-3">
      <LayerBlock title="ЦБ · официально" items={officialItems(view)} />
      <LayerBlock title="MOEX · рынок" items={moexItems(view)} />
      <LayerBlock title="Вручную / demo" items={manualDemoItems(view)} />
    </div>
  );
}

function EventBadge({ badge }: { badge: CbrDataIntegrityView["eventBadge"] }) {
  const tone =
    badge === "official"
      ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200/90"
      : badge === "manual"
        ? "border-violet-400/35 bg-violet-500/10 text-violet-200/90"
        : "border-amber-400/35 bg-amber-500/10 text-amber-200/90";

  return (
    <span
      className={cn(
        "inline-flex h-4 shrink-0 items-center rounded border px-1.5 text-[7px] font-semibold uppercase tracking-wide",
        tone,
      )}
    >
      {CBR_EVENT_INTEGRITY_LABELS[badge]}
    </span>
  );
}

function InstrumentRow({
  instruments,
  className,
}: {
  instruments: CbrDataIntegrityView["instruments"];
  className?: string;
}) {
  const visible = instruments.filter((i) => i.slotId !== "bonds");
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((inst) => (
        <span
          key={inst.slotId}
          className="inline-flex items-center gap-0.5 rounded border border-lab-border/35 bg-lab-bg-deep/50 px-1 py-0.5 font-mono text-[8px]"
        >
          <span className="text-lab-text">{inst.ticker}</span>
          <InstrumentStatusDot status={inst.status} />
        </span>
      ))}
    </div>
  );
}

function InstrumentStatusDot({ status }: { status: CbrDataIntegrityView["instruments"][0]["status"] }) {
  const tone =
    status === "moex"
      ? "text-emerald-300/90"
      : status === "partial"
        ? "text-violet-300/90"
        : status === "demo"
          ? "text-amber-300/85"
          : "text-lab-dim";

  return (
    <span className={cn("uppercase tracking-wide", tone)}>
      {CBR_INSTRUMENT_INTEGRITY_LABELS[status]}
    </span>
  );
}

function LayerBlock({ title, items }: { title: string; items: Array<{ ok: boolean; label: string }> }) {
  return (
    <div className="rounded border border-lab-border/30 bg-lab-bg-deep/25 px-2 py-1.5">
      <p className="mb-1 text-[8px] font-medium uppercase tracking-[0.12em] text-lab-dim">{title}</p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li
            key={item.label}
            className={cn(
              "flex items-center gap-1.5",
              item.ok ? "text-lab-muted" : "text-lab-dim/70",
            )}
          >
            <span className={cn("text-[8px]", item.ok ? "text-emerald-400/80" : "text-lab-dim")}>
              {item.ok ? "✓" : "·"}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function officialItems(view: CbrDataIntegrityView) {
  const o = view.layers.official;
  return [
    { ok: o.date, label: "дата заседания" },
    { ok: o.rateBefore, label: "ставка до" },
    { ok: o.rateAfter, label: "ставка после" },
    { ok: o.pressRelease, label: "пресс-релиз" },
    { ok: o.decisionTime13_30, label: "публикация 13:30" },
  ];
}

function moexItems(view: CbrDataIntegrityView) {
  const m = view.layers.moex;
  return [
    { ok: m.candles, label: "свечи за день" },
    { ok: m.volume, label: "объём" },
    { ok: m.dayRange, label: "диапазон дня" },
  ];
}

function manualDemoItems(view: CbrDataIntegrityView) {
  const man = view.layers.manual;
  return [
    { ok: man.expectation, label: "ожидание рынка (ручное)" },
    { ok: man.tone, label: "краткий тон (ручное)" },
    { ok: man.traderTakeaway, label: "трейдерский вывод" },
    { ok: !view.layers.usesDemoFallback, label: "графики без demo fallback" },
  ];
}

export function useCbrDataIntegrityView(
  event: CbrRateEvent | undefined,
  chartModel: CbrReactionChartGridModel | null,
  loading?: boolean,
) {
  return React.useMemo(() => {
    if (!event) {
      return buildDataIntegrityView(
        {
          id: "",
          date: "",
          year: 0,
          title: "",
          decisionTime: "13:30",
          previousRate: null,
          expectedRate: null,
          actualRate: null,
          changeBps: null,
          surpriseBps: null,
          decisionType: "upcoming",
          expectationType: "unknown",
          tone: "unknown",
          summary: "",
          traderTakeaway: "",
          dataStatus: "mock",
          sourceStatus: "official",
          expectationStatus: "unknown",
          instruments: [],
        },
        [],
      );
    }
    const instruments = loading ? [] : instrumentsDataFromChartSlots(chartModel?.slots);
    return buildDataIntegrityView(event, instruments);
  }, [event, chartModel, loading]);
}
