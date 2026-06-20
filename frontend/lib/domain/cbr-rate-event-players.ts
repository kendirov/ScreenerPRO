/**
 * CBR event replay — «кто был в игре в день ставки».
 * Отдельный слой от Market Radar: те же трейдерские слова, свои критерии отбора.
 */

import type { CbrDataStatus, CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import { RADAR_ACTIVITY_REASON, RADAR_ROW_TAG } from "@/lib/domain/radar-ui-labels";

/** Теги в строке — словарь ScreenerPRO (не формулы Radar). */
export const CBR_EVENT_PLAYER_TAGS = {
  inPlay: RADAR_ROW_TAG.inPlay,
  active: RADAR_ROW_TAG.active,
  volatility: "волатильность",
  liquidity: "ликвидность",
  thin: RADAR_ROW_TAG.thin,
  volumeMove: "объём + ход",
  tradesMove: RADAR_ACTIVITY_REASON.tradesMove,
  volumeTrades: RADAR_ACTIVITY_REASON.volumeTrades,
  postDecision: "после 13:30",
  postPress: "после 15:00",
} as const;

export type CbrEventPlayerTag = (typeof CBR_EVENT_PLAYER_TAGS)[keyof typeof CBR_EVENT_PLAYER_TAGS];

export type CbrEventPlayerSignalKind =
  | "top-turnover"
  | "elevated-volatility"
  | "trades-surge"
  | "post-decision-reaction"
  | "post-press-reaction";

export const CBR_EVENT_PLAYER_SIGNAL_LABELS: Record<CbrEventPlayerSignalKind, string> = {
  "top-turnover": "топ оборота",
  "elevated-volatility": "волатильность",
  "trades-surge": "всплеск сделок",
  "post-decision-reaction": "реакция 13:30",
  "post-press-reaction": "реакция 15:00",
};

export type CbrEventPlayersSectionId =
  | "currency"
  | "index"
  | "banks"
  | "exporters"
  | "second-tier";

export const CBR_EVENT_PLAYERS_SECTION_LABELS: Record<CbrEventPlayersSectionId, string> = {
  currency: "Валютная реакция",
  index: "Индексная реакция",
  banks: "Банки",
  exporters: "Экспортёры",
  "second-tier": "Второй эшелон / аномалии",
};

export type CbrEventPlayersSource = "mock" | "moex-screener" | "partial";

export const CBR_EVENT_PLAYERS_SOURCE_LABELS: Record<CbrEventPlayersSource, string> = {
  mock: "mock · replay",
  "moex-screener": "MOEX · screener",
  partial: "частично MOEX",
};

/** Строка блока — готова к подстановке из MOEX/screener ingest. */
export type CbrEventPlayerRow = {
  ticker: string;
  name: string;
  /** Отображаемый оборот: абсолют или × к базе. */
  turnover: string;
  /** Сделки: абсолют или × к базе. */
  trades: string;
  rangePct: number | null;
  reactionTag: CbrEventPlayerTag | string;
  whyInPlay: string;
  signals: CbrEventPlayerSignalKind[];
  dataStatus: CbrDataStatus;
  /** Для будущего join с screener row id */
  secid?: string;
};

export type CbrEventPlayersSection = {
  id: CbrEventPlayersSectionId;
  title: string;
  players: CbrEventPlayerRow[];
};

export type CbrEventPlayersSnapshot = {
  eventId: string;
  date: string;
  source: CbrEventPlayersSource;
  sourceLabel: string;
  sections: CbrEventPlayersSection[];
  emptyReason: string | null;
};

function section(
  id: CbrEventPlayersSectionId,
  players: CbrEventPlayerRow[],
): CbrEventPlayersSection {
  return { id, title: CBR_EVENT_PLAYERS_SECTION_LABELS[id], players };
}

function formatRangePct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

export { formatRangePct as formatCbrEventPlayerRangePct };

// —— Mock replay catalog (по eventId) ——

const MOCK_PLAYERS_BY_EVENT: Record<string, CbrEventPlayersSection[]> = {
  "2026-04-24": [
    section("currency", [
      {
        ticker: "Si",
        name: "USD/RUB fut",
        turnover: "2.8×",
        trades: "3.2×",
        rangePct: 1.45,
        reactionTag: CBR_EVENT_PLAYER_TAGS.inPlay,
        whyInPlay: "Лидер ликвидности валютного блока — первый ход после 13:30.",
        signals: ["top-turnover", "post-decision-reaction", "trades-surge"],
        dataStatus: "mock",
        secid: "SiM6",
      },
      {
        ticker: "CNY",
        name: "CNY/RUB fut",
        turnover: "1.6×",
        trades: "1.9×",
        rangePct: 0.82,
        reactionTag: CBR_EVENT_PLAYER_TAGS.volumeMove,
        whyInPlay: "Объём + ход в корзине — вторичная нога после Si.",
        signals: ["top-turnover", "post-decision-reaction"],
        dataStatus: "mock",
      },
    ]),
    section("index", [
      {
        ticker: "MX",
        name: "IMOEX fut",
        turnover: "2.1×",
        trades: "2.4×",
        rangePct: 1.12,
        reactionTag: CBR_EVENT_PLAYER_TAGS.volatility,
        whyInPlay: "Индекс в игре: широкий день и импульс на факте снижения.",
        signals: ["elevated-volatility", "post-decision-reaction"],
        dataStatus: "mock",
      },
    ]),
    section("banks", [
      {
        ticker: "SBER",
        name: "Сбербанк",
        turnover: "1.9×",
        trades: "2.0×",
        rangePct: 1.35,
        reactionTag: CBR_EVENT_PLAYER_TAGS.active,
        whyInPlay: "Банк активен — ставочный сенситив, ход после 13:30.",
        signals: ["top-turnover", "post-decision-reaction", "elevated-volatility"],
        dataStatus: "mock",
      },
      {
        ticker: "VTBR",
        name: "ВТБ",
        turnover: "1.4×",
        trades: "1.5×",
        rangePct: 1.08,
        reactionTag: CBR_EVENT_PLAYER_TAGS.tradesMove,
        whyInPlay: "Сделки + движение — сектор тянет ленту вместе с SBER.",
        signals: ["trades-surge", "post-decision-reaction"],
        dataStatus: "mock",
      },
    ]),
    section("exporters", [
      {
        ticker: "GAZP",
        name: "Газпром",
        turnover: "1.3×",
        trades: "1.2×",
        rangePct: 0.95,
        reactionTag: CBR_EVENT_PLAYER_TAGS.liquidity,
        whyInPlay: "Ликвидность в тяжёлом секторе — смотреть относительно MX.",
        signals: ["top-turnover"],
        dataStatus: "mock",
      },
    ]),
    section("second-tier", [
      {
        ticker: "AFLT",
        name: "Аэрофлот",
        turnover: "2.6×",
        trades: "3.4×",
        rangePct: 2.1,
        reactionTag: CBR_EVENT_PLAYER_TAGS.thin,
        whyInPlay: "Тонко + всплеск сделок — аномалия второго эшелона на ставке.",
        signals: ["trades-surge", "elevated-volatility", "post-press-reaction"],
        dataStatus: "mock",
      },
      {
        ticker: "OFZ",
        name: "ОФЗ (кривая)",
        turnover: "1.7×",
        trades: "—",
        rangePct: 0.65,
        reactionTag: CBR_EVENT_PLAYER_TAGS.postPress,
        whyInPlay: "Реакция после 15:00 — тон брифинга важнее первого импульса.",
        signals: ["post-press-reaction", "post-decision-reaction"],
        dataStatus: "mock",
      },
    ]),
  ],
  "2026-02-14": [
    section("currency", [
      {
        ticker: "Si",
        name: "USD/RUB fut",
        turnover: "1.5×",
        trades: "1.4×",
        rangePct: 0.72,
        reactionTag: CBR_EVENT_PLAYER_TAGS.postPress,
        whyInPlay: "Hold без сюрприза — основной ход валюты после 15:00.",
        signals: ["post-press-reaction"],
        dataStatus: "mock",
      },
    ]),
    section("index", [
      {
        ticker: "MX",
        name: "IMOEX fut",
        turnover: "1.2×",
        trades: "1.1×",
        rangePct: 0.55,
        reactionTag: CBR_EVENT_PLAYER_TAGS.active,
        whyInPlay: "Активность умеренная — рынок ждал тон, не уровень.",
        signals: ["post-press-reaction"],
        dataStatus: "mock",
      },
    ]),
    section("banks", [
      {
        ticker: "SBER",
        name: "Сбербанк",
        turnover: "1.6×",
        trades: "1.7×",
        rangePct: 0.88,
        reactionTag: CBR_EVENT_PLAYER_TAGS.inPlay,
        whyInPlay: "В игре на hawkish тоне — барометр сектора после 15:00.",
        signals: ["top-turnover", "post-press-reaction", "trades-surge"],
        dataStatus: "mock",
      },
    ]),
    section("exporters", [
      {
        ticker: "GAZP",
        name: "Газпром",
        turnover: "1.1×",
        trades: "1.0×",
        rangePct: 0.62,
        reactionTag: CBR_EVENT_PLAYER_TAGS.liquidity,
        whyInPlay: "Ликвидность без сильного хода — фон для лидеров.",
        signals: ["top-turnover"],
        dataStatus: "mock",
      },
    ]),
    section("second-tier", [
      {
        ticker: "LKOH",
        name: "Лукойл",
        turnover: "1.8×",
        trades: "2.2×",
        rangePct: 1.15,
        reactionTag: CBR_EVENT_PLAYER_TAGS.volatility,
        whyInPlay: "Волатильность выше сектора — всплеск сделок к 15:00.",
        signals: ["elevated-volatility", "trades-surge", "post-press-reaction"],
        dataStatus: "mock",
      },
    ]),
  ],
};

const UPCOMING_EMPTY_REASON =
  "Снимок «в игре» появится в день заседания — топ оборота, сделки и реакции 13:30 / 15:00.";

const NO_MOCK_REASON = "Нет replay-снимка для этой даты — подключите MOEX screener ingest.";

export function getCbrEventPlayersSnapshot(event: CbrRateEvent): CbrEventPlayersSnapshot {
  if (event.status === "upcoming") {
    return {
      eventId: event.id,
      date: event.date,
      source: "mock",
      sourceLabel: CBR_EVENT_PLAYERS_SOURCE_LABELS.mock,
      sections: emptySections(),
      emptyReason: UPCOMING_EMPTY_REASON,
    };
  }

  const sections = MOCK_PLAYERS_BY_EVENT[event.id];
  if (!sections) {
    return {
      eventId: event.id,
      date: event.date,
      source: "mock",
      sourceLabel: CBR_EVENT_PLAYERS_SOURCE_LABELS.mock,
      sections: emptySections(),
      emptyReason: NO_MOCK_REASON,
    };
  }

  return {
    eventId: event.id,
    date: event.date,
    source: "mock",
    sourceLabel: CBR_EVENT_PLAYERS_SOURCE_LABELS.mock,
    sections,
    emptyReason: null,
  };
}

function emptySections(): CbrEventPlayersSection[] {
  return (Object.keys(CBR_EVENT_PLAYERS_SECTION_LABELS) as CbrEventPlayersSectionId[]).map((id) =>
    section(id, []),
  );
}

/** Будущий ingest: screener rows → event players (контракт без Market Radar math). */
export type CbrEventPlayersIngestRow = {
  ticker: string;
  name: string;
  sectionId: CbrEventPlayersSectionId;
  turnover: string;
  trades: string;
  rangePct: number | null;
  reactionTag: string;
  whyInPlay: string;
  signals: CbrEventPlayerSignalKind[];
  dataStatus?: CbrDataStatus;
  secid?: string;
};

export function buildEventPlayersSnapshotFromIngest(input: {
  event: CbrRateEvent;
  source: CbrEventPlayersSource;
  rows: CbrEventPlayersIngestRow[];
}): CbrEventPlayersSnapshot {
  const bySection = emptySections().map((s) => ({ ...s, players: [] as CbrEventPlayerRow[] }));

  for (const row of input.rows) {
    const bucket = bySection.find((s) => s.id === row.sectionId);
    if (!bucket) continue;
    bucket.players.push({
      ticker: row.ticker,
      name: row.name,
      turnover: row.turnover,
      trades: row.trades,
      rangePct: row.rangePct,
      reactionTag: row.reactionTag,
      whyInPlay: row.whyInPlay,
      signals: row.signals,
      dataStatus: row.dataStatus ?? "live",
      secid: row.secid,
    });
  }

  return {
    eventId: input.event.id,
    date: input.event.date,
    source: input.source,
    sourceLabel: CBR_EVENT_PLAYERS_SOURCE_LABELS[input.source],
    sections: bySection,
    emptyReason: input.rows.length === 0 ? NO_MOCK_REASON : null,
  };
}

export function countEventPlayers(snapshot: CbrEventPlayersSnapshot): number {
  return snapshot.sections.reduce((n, s) => n + s.players.length, 0);
}
