/**
 * CBR rate-reaction cockpit — phases, insights, instrument inspector.
 */

import type { CbrReactionChartGridModel } from "@/lib/domain/cbr-rate-chart-model";
import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import { mskTimeToUnix } from "@/lib/domain/cbr-rate-event-window";
import { buildExpectationVsFactView } from "@/lib/domain/cbr-rate-expectation";
import {
  CBR_REACTION_PATTERN_LABELS,
  type CbrInstrumentReactionMetrics,
  type CbrReactionPatternId,
  type CbrReactionWindowId,
} from "@/lib/domain/cbr-rate-reaction-metrics";

export type CbrCockpitBarMode = "before" | "decision" | "press" | "close";

export type CbrCockpitPhaseId =
  | "before"
  | "decision"
  | "after-decision"
  | "press"
  | "close";

export type CbrCockpitPhase = {
  id: CbrCockpitPhaseId;
  label: string;
  hint: string;
  barMode: CbrCockpitBarMode;
  fromMsk: string;
  toMsk: string;
  matrixColumns: Array<"5m" | "30m" | "postPress" | "day" | "volume">;
};

export const CBR_COCKPIT_BAR_MODE_LABELS: Record<CbrCockpitBarMode, string> = {
  before: "до решения",
  decision: "решение",
  press: "пресс-конференция",
  close: "закрытие",
};

export const CBR_COCKPIT_PHASES: CbrCockpitPhase[] = [
  {
    id: "before",
    label: "До решения",
    hint: "10:00–13:29",
    barMode: "before",
    fromMsk: "10:00",
    toMsk: "13:29",
    matrixColumns: [],
  },
  {
    id: "decision",
    label: "13:30",
    hint: "первый импульс",
    barMode: "decision",
    fromMsk: "13:30",
    toMsk: "13:35",
    matrixColumns: ["5m", "30m"],
  },
  {
    id: "after-decision",
    label: "После решения",
    hint: "13:35–14:59",
    barMode: "decision",
    fromMsk: "13:35",
    toMsk: "14:59",
    matrixColumns: ["30m"],
  },
  {
    id: "press",
    label: "15:00",
    hint: "тон брифинга",
    barMode: "press",
    fromMsk: "15:00",
    toMsk: "16:00",
    matrixColumns: ["postPress"],
  },
  {
    id: "close",
    label: "Закрытие",
    hint: "16:00–18:45",
    barMode: "close",
    fromMsk: "16:00",
    toMsk: "18:45",
    matrixColumns: ["day", "volume"],
  },
];

export const CBR_COCKPIT_PHASE_BY_ID: Record<CbrCockpitPhaseId, CbrCockpitPhase> = Object.fromEntries(
  CBR_COCKPIT_PHASES.map((p) => [p.id, p]),
) as Record<CbrCockpitPhaseId, CbrCockpitPhase>;

export function resolvePhaseHighlightUnix(
  date: string,
  phaseId: CbrCockpitPhaseId,
): { fromUnix: number; toUnix: number } {
  const phase = CBR_COCKPIT_PHASE_BY_ID[phaseId];
  return {
    fromUnix: mskTimeToUnix(date, phase.fromMsk),
    toUnix: mskTimeToUnix(date, phase.toMsk),
  };
}

export function phaseHighlightPercents(
  windowStartUnix: number,
  windowEndUnix: number,
  phaseFromUnix: number,
  phaseToUnix: number,
): { leftPct: number; widthPct: number } | null {
  const span = windowEndUnix - windowStartUnix;
  if (span <= 0) return null;

  const from = Math.max(phaseFromUnix, windowStartUnix);
  const to = Math.min(phaseToUnix, windowEndUnix);
  if (to <= from) return null;

  return {
    leftPct: ((from - windowStartUnix) / span) * 100,
    widthPct: ((to - from) / span) * 100,
  };
}

export type CbrInstrumentInspectorView = {
  ticker: string;
  title: string;
  whatHappened: string;
  impulseRead: string;
  volumeRead: string;
  postPressRead: string;
  dataStatus: CbrInstrumentReactionMetrics["dataStatus"];
};

function formatPctShort(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function absPct(v: number | null): number {
  return v == null ? 0 : Math.abs(v);
}

function sameSign(a: number | null, b: number | null): boolean {
  if (a == null || b == null || a === 0 || b === 0) return false;
  return Math.sign(a) === Math.sign(b);
}

export function buildInstrumentInspector(row: CbrInstrumentReactionMetrics): CbrInstrumentInspectorView {
  const impulse = row.reaction5mPct;
  const digest = row.reaction30mPct;
  const post = row.reactionPostPressPct;

  let impulseRead = "Импульс в 13:30 не выражен по свечам.";
  if (impulse != null && absPct(impulse) >= 0.12) {
    impulseRead = `Импульс 13:30–13:35: ${formatPctShort(impulse)} — основной ход в первые минуты.`;
  } else if (digest != null && absPct(digest) > absPct(impulse)) {
    impulseRead = `Первые минуты слабые (${formatPctShort(impulse)}), ход нарастал к 14:00: ${formatPctShort(digest)}.`;
  }

  let volumeRead = "Объём в норме относительно утреннего окна.";
  if (row.pattern === "late-volume") {
    volumeRead = "Оборот усилился после 15:00 — вход с задержкой.";
  } else if (row.volumeRatio != null && row.volumeRatio >= 1.35) {
    volumeRead = `Объём дня ${row.volumeRatio.toFixed(1)}× выше оценки — активное переложение.`;
  } else if (row.volumeRatio != null && row.volumeRatio < 0.85) {
    volumeRead = `Объём ${row.volumeRatio.toFixed(1)}× — реакция на тонком рынке.`;
  }

  let postPressRead = "После 15:00 подтверждение неочевидно.";
  if (post != null && digest != null) {
    if (sameSign(post, digest) && absPct(post) >= 0.08) {
      postPressRead = `После 15:00 движение ${formatPctShort(post)} — в сторону 30м импульса.`;
    } else if (!sameSign(post, digest) && absPct(post) >= 0.08) {
      postPressRead = `После 15:00 разворот (${formatPctShort(post)}) — первый импульс не удержался.`;
    } else if (absPct(post) < 0.06) {
      postPressRead = "После 15:00 ход слабый — тон не дал второго импульса.";
    }
  }

  const whatHappened =
    row.traderRead ??
    (row.reactionDayPct != null
      ? `День: ${formatPctShort(row.reactionDayPct)} по свечам 10:00–18:45.`
      : "Недостаточно свечей для разбора.");

  return {
    ticker: row.ticker,
    title: row.title,
    whatHappened,
    impulseRead,
    volumeRead,
    postPressRead,
    dataStatus: row.dataStatus,
  };
}

export type CbrCockpitInsightKind =
  | "lead-instrument"
  | "false-impulse"
  | "volume-location"
  | "next-time";

export type CbrCockpitInsight = {
  kind: CbrCockpitInsightKind;
  title: string;
  body: string;
  ticker?: string;
  empty?: boolean;
};

export function buildCockpitInsights(input: {
  event: CbrRateEvent;
  rows: CbrInstrumentReactionMetrics[];
  chartModel: CbrReactionChartGridModel | null;
}): CbrCockpitInsight[] {
  const { event, rows, chartModel } = input;
  const expectation = buildExpectationVsFactView(event);

  const lead = rows.reduce<CbrInstrumentReactionMetrics | null>((best, row) => {
    if (!best) return row;
    return absPct(row.reactionDayPct) > absPct(best.reactionDayPct) ? row : best;
  }, null);

  const falseImpulse = rows.find((r) => r.pattern === "false-breakout");
  const lateVol = rows.find((r) => r.pattern === "late-volume");
  const volLead = rows.reduce<CbrInstrumentReactionMetrics | null>((best, row) => {
    if (row.volumeRatio == null) return best;
    if (!best || (best.volumeRatio ?? 0) < row.volumeRatio) return row;
    return best;
  }, null);

  const dataNote =
    chartModel?.bundleDataStatus === "live"
      ? ""
      : chartModel?.bundleDataStatus === "partial"
        ? " (частично MOEX)"
        : chartModel
          ? " · нет live MOEX"
          : "";

  return [
    {
      kind: "lead-instrument",
      title: "Главный инструмент реакции",
      body: lead
        ? `${formatPctShort(lead.reactionDayPct)} за день${lead.patternLabel ? ` · ${lead.patternLabel}` : ""}${dataNote}`
        : event.status === "upcoming"
          ? "После заседания — лидер по |день %|."
          : "Нет свечей — нет данных.",
      ticker: lead?.ticker,
      empty: !lead,
    },
    {
      kind: "false-impulse",
      title: "Ложный первый импульс",
      body: falseImpulse
        ? `5м ${formatPctShort(falseImpulse.reaction5mPct)} → день ${formatPctShort(falseImpulse.reactionDayPct)}`
        : rows.length
          ? "Явного ложного выноса по паттерну нет."
          : "—",
      ticker: falseImpulse?.ticker,
      empty: !falseImpulse,
    },
    {
      kind: "volume-location",
      title: "Где пришёл объём",
      body: lateVol
        ? CBR_REACTION_PATTERN_LABELS["late-volume"]
        : volLead?.volumeRatio != null
          ? `${volLead.volumeRatio.toFixed(1)}× к утренней оценке`
          : "Объём не выделился.",
      ticker: (lateVol ?? volLead)?.ticker,
      empty: !lateVol && !volLead,
    },
    {
      kind: "next-time",
      title: "Что смотреть в следующий раз",
      body: expectation.dayRiskRead,
      empty: false,
    },
  ];
}

export function matrixColumnActive(
  phase: CbrCockpitPhase,
  column: "5m" | "30m" | "postPress" | "day" | "volume",
): boolean {
  return phase.matrixColumns.includes(column);
}

export function phaseWindowId(phaseId: CbrCockpitPhaseId): CbrReactionWindowId | null {
  switch (phaseId) {
    case "before":
      return "preDecision";
    case "decision":
      return "firstImpulse";
    case "after-decision":
      return "prePress";
    case "press":
      return "postPress";
    case "close":
      return "closePhase";
    default:
      return null;
  }
}

export function resolveDataProvenanceLabel(
  chartModel: CbrReactionChartGridModel | null,
  loading: boolean,
): { label: string; honest: boolean } {
  if (loading) return { label: "загрузка…", honest: true };
  if (!chartModel) return { label: "нет данных", honest: true };
  if (chartModel.bundleDataStatus === "live") return { label: "MOEX ISS", honest: true };
  if (chartModel.bundleDataStatus === "partial") return { label: "частично MOEX", honest: true };
  return { label: "нет данных MOEX", honest: true };
}
