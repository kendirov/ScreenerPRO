import type { ReactionDataStatus, ReactionWindowKey } from "@/lib/event-reactions/reaction-types";

export type ReactionWindowDef = {
  key: ReactionWindowKey;
  label: string;
  labelShort: string;
  /** Offset from eventTime in milliseconds (negative = before event) */
  offsetMs: number;
  /** Duration of window in milliseconds (for post-event windows) */
  durationMs: number | null;
  /** Can be computed on 1-minute candles today */
  minuteCandleSupported: boolean;
  /** Requires tick / sub-minute data */
  requiresTickData: boolean;
  defaultDataStatus: ReactionDataStatus;
  group: "pre" | "post" | "planned";
};

/** Active reaction windows — honest on 1m candles where supported */
export const REACTION_WINDOWS: ReactionWindowDef[] = [
  {
    key: "pre_15m",
    label: "До новости · 15 мин",
    labelShort: "−15м",
    offsetMs: -15 * 60_000,
    durationMs: 15 * 60_000,
    minuteCandleSupported: true,
    requiresTickData: false,
    defaultDataStatus: "no_data",
    group: "pre",
  },
  {
    key: "pre_5m",
    label: "До новости · 5 мин",
    labelShort: "−5м",
    offsetMs: -5 * 60_000,
    durationMs: 5 * 60_000,
    minuteCandleSupported: true,
    requiresTickData: false,
    defaultDataStatus: "no_data",
    group: "pre",
  },
  {
    key: "plus_1m",
    label: "После · 1 мин",
    labelShort: "+1м",
    offsetMs: 0,
    durationMs: 1 * 60_000,
    minuteCandleSupported: true,
    requiresTickData: false,
    defaultDataStatus: "no_data",
    group: "post",
  },
  {
    key: "plus_2m",
    label: "После · 2 мин",
    labelShort: "+2м",
    offsetMs: 0,
    durationMs: 2 * 60_000,
    minuteCandleSupported: true,
    requiresTickData: false,
    defaultDataStatus: "no_data",
    group: "post",
  },
  {
    key: "plus_5m",
    label: "После · 5 мин",
    labelShort: "+5м",
    offsetMs: 0,
    durationMs: 5 * 60_000,
    minuteCandleSupported: true,
    requiresTickData: false,
    defaultDataStatus: "no_data",
    group: "post",
  },
  {
    key: "plus_15m",
    label: "После · 15 мин",
    labelShort: "+15м",
    offsetMs: 0,
    durationMs: 15 * 60_000,
    minuteCandleSupported: true,
    requiresTickData: false,
    defaultDataStatus: "no_data",
    group: "post",
  },
  {
    key: "plus_30m",
    label: "После · 30 мин",
    labelShort: "+30м",
    offsetMs: 0,
    durationMs: 30 * 60_000,
    minuteCandleSupported: true,
    requiresTickData: false,
    defaultDataStatus: "no_data",
    group: "post",
  },
  {
    key: "plus_40m",
    label: "После · 40 мин",
    labelShort: "+40м",
    offsetMs: 0,
    durationMs: 40 * 60_000,
    minuteCandleSupported: true,
    requiresTickData: false,
    defaultDataStatus: "no_data",
    group: "post",
  },
  {
    key: "plus_1d",
    label: "После · 1 день",
    labelShort: "+1д",
    offsetMs: 0,
    durationMs: 24 * 60 * 60_000,
    minuteCandleSupported: false,
    requiresTickData: false,
    defaultDataStatus: "no_data",
    group: "post",
  },
  {
    key: "plus_3d",
    label: "После · 3 дня",
    labelShort: "+3д",
    offsetMs: 0,
    durationMs: 3 * 24 * 60 * 60_000,
    minuteCandleSupported: false,
    requiresTickData: false,
    defaultDataStatus: "no_data",
    group: "post",
  },
];

/** Planned sub-minute windows — need tick-data / QUIK / broker stream */
export const PLANNED_TICK_WINDOWS: ReactionWindowDef[] = [
  {
    key: "planned_plus_5s",
    label: "После · 5 сек",
    labelShort: "+5с",
    offsetMs: 0,
    durationMs: 5_000,
    minuteCandleSupported: false,
    requiresTickData: true,
    defaultDataStatus: "planned_tick_data",
    group: "planned",
  },
  {
    key: "planned_plus_30s",
    label: "После · 30 сек",
    labelShort: "+30с",
    offsetMs: 0,
    durationMs: 30_000,
    minuteCandleSupported: false,
    requiresTickData: true,
    defaultDataStatus: "planned_tick_data",
    group: "planned",
  },
];

export const ALL_WINDOW_KEYS = [
  ...REACTION_WINDOWS.map((w) => w.key),
  ...PLANNED_TICK_WINDOWS.map((w) => w.key),
] as const;

export function getWindowDef(key: ReactionWindowKey): ReactionWindowDef | undefined {
  return REACTION_WINDOWS.find((w) => w.key === key) ?? PLANNED_TICK_WINDOWS.find((w) => w.key === key);
}

export function getAnalyzableWindows(): ReactionWindowDef[] {
  return REACTION_WINDOWS.filter((w) => !w.requiresTickData);
}

export function getWindowLabel(key: ReactionWindowKey): string {
  return getWindowDef(key)?.label ?? key;
}

/** Windows shown in the main UI table (excludes planned tick windows) */
export const UI_POST_WINDOWS = REACTION_WINDOWS.filter((w) => w.group === "post");

export const UI_PRE_WINDOWS = REACTION_WINDOWS.filter((w) => w.group === "pre");
