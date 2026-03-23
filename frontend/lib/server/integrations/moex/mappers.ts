import type { AssetClass } from "@screenerpro/shared";

function rowToObject(columns: string[], row: unknown[]) {
  return Object.fromEntries(columns.map((column, idx) => [column, row[idx]]));
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

export interface NormalizedInstrument {
  stableKey: string;
  ticker: string;
  shortName: string | null;
  assetClass: AssetClass;
  secid: string | null;
  board: string | null;
  engine: string | null;
  market: string | null;
  lotSize: number | null;
  isActive: boolean;
  sourceEntityId: string;
  rawMetadata: string;
}

export function mapUniverseRows(assetClass: AssetClass, columns: string[], rows: unknown[][]): NormalizedInstrument[] {
  const results: NormalizedInstrument[] = [];
  for (const rawRow of rows) {
    const item = rowToObject(columns, rawRow);
    const secid = str(item.SECID);
    if (!secid) continue;
    const board = str(item.BOARDID);
    const engine = str(item.ENGINE);
    const market = str(item.MARKET);
    results.push({
      stableKey: `${assetClass}:${secid}`,
      ticker: secid,
      shortName: str(item.SHORTNAME),
      assetClass,
      secid,
      board,
      engine,
      market,
      lotSize: num(item.LOTSIZE),
      isActive: str(item.STATUS) !== "D",
      sourceEntityId: `${secid}:${board ?? ""}:${engine ?? ""}:${market ?? ""}`,
      rawMetadata: JSON.stringify(item),
    });
  }
  return results;
}

export interface NormalizedSnapshot {
  ticker: string;
  sourceUpdatedAt: Date | null;
  lastPrice: number | null;
  previousClose: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
  volume: number | null;
  turnover: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  tradingStatus: string;
  lotSize: number | null;
  rawPayload: string;
}

export function mapSnapshots(
  securitiesColumns: string[],
  securitiesRows: unknown[][],
  marketColumns: string[],
  marketRows: unknown[][],
): NormalizedSnapshot[] {
  const marketBySecid = new Map<string, Record<string, unknown>>();
  for (const row of marketRows) {
    const item = rowToObject(marketColumns, row);
    const secid = str(item.SECID);
    if (secid) marketBySecid.set(secid, item);
  }

  const results: NormalizedSnapshot[] = [];
  for (const rawRow of securitiesRows) {
    const sec = rowToObject(securitiesColumns, rawRow);
    const secid = str(sec.SECID);
    if (!secid) continue;
    const md = marketBySecid.get(secid) ?? {};
    const lastPrice = num(md.LAST) ?? num(md.LCURRENTPRICE);
    const previousClose = num(md.PREVPRICE) ?? num(md.PREVWAPRICE);
    const open = num(md.OPEN);
    const high = num(md.HIGH);
    const low = num(md.LOW);
    results.push({
      ticker: secid,
      sourceUpdatedAt: null,
      lastPrice,
      previousClose,
      absoluteChange: lastPrice !== null && previousClose !== null ? lastPrice - previousClose : null,
      percentChange: lastPrice !== null && previousClose ? ((lastPrice - previousClose) / previousClose) * 100 : null,
      volume: num(md.VOLUME),
      turnover: num(md.VALUE),
      open,
      high,
      low,
      tradingStatus: str(md.TRADINGSTATUS) ?? "unknown",
      lotSize: num(sec.LOTSIZE),
      rawPayload: JSON.stringify({ sec, md }),
    });
  }
  return results;
}

export interface NormalizedHistoryBar {
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  turnover: number | null;
  rawPayload: string;
}

export function mapHistoryBars(columns: string[], rows: unknown[][]): NormalizedHistoryBar[] {
  const results: NormalizedHistoryBar[] = [];
  for (const rawRow of rows) {
    const item = rowToObject(columns, rawRow);
    const dateValue = str(item.TRADEDATE);
    if (!dateValue) continue;
    results.push({
      date: new Date(`${dateValue}T00:00:00.000Z`),
      open: num(item.OPEN),
      high: num(item.HIGH),
      low: num(item.LOW),
      close: num(item.CLOSE),
      volume: num(item.VOLUME),
      turnover: num(item.VALUE),
      rawPayload: JSON.stringify(item),
    });
  }
  return results;
}
