import { classifyStockLiquidity } from "@/lib/server/domain/liquidity";
import { fetchIssJson } from "@/lib/server/moex-iss/http";
import { moexIssPayloadSchema } from "@/lib/server/moex-iss/schemas";
import type { TechnicalCharacteristicsResponse, TechnicalCharacteristicsRow, ValueWithStatus } from "@/lib/materials/contracts";

type TableRow = Record<string, unknown>;

const STOCK_COMMISSION_RATE = 0.0004;
const FUTURES_COMMISSION_RATE = 0.0002;
const CACHE_TTL_MS = 20_000;

let lastSnapshot: { expiresAt: number; payload: TechnicalCharacteristicsResponse } | null = null;

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function rowToObject(columns: string[], row: unknown[]): TableRow {
  return Object.fromEntries(columns.map((column, idx) => [column, row[idx]]));
}

function valueWithStatus(value: number | null, mode: "available" | "derived" = "available", note?: string): ValueWithStatus {
  if (value === null) return { value: null, status: "unavailable", note: note ?? null };
  return { value, status: mode, note: note ?? null };
}

function spreadPct(bid: number | null, offer: number | null, last: number | null): number | null {
  if (bid === null || offer === null || bid <= 0 || offer <= 0 || offer < bid) return null;
  const anchor = last && last > 0 ? last : (bid + offer) / 2;
  if (!anchor || anchor <= 0) return null;
  return ((offer - bid) / anchor) * 100;
}

function daysToExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const parsed = new Date(expiryDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const diff = parsed.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 3600 * 1000)));
}

function availabilityConfidence(row: TechnicalCharacteristicsRow): number {
  const metricFields = [
    row.lotSize,
    row.priceStep,
    row.stepValue,
    row.currentPrice,
    row.lotPrice,
    row.spreadPct,
    row.tradesCount,
    row.turnoverRub,
    row.commissionRub,
    row.pointsToCoverCommission,
  ];
  const available = metricFields.filter((field) => field.status !== "unavailable").length;
  return Math.round((available / metricFields.length) * 100);
}

function liquidityQuality(turnover: number | null, trades: number | null): "high" | "medium" | "low" | "unknown" {
  if (turnover === null || trades === null) return "unknown";
  if (turnover >= 2_000_000_000 && trades >= 8_000) return "high";
  if (turnover >= 400_000_000 && trades >= 2_000) return "medium";
  return "low";
}

function scalabilityHint(input: { spreadPct: number | null; turnoverPerTrade: number | null; liquidity: "high" | "medium" | "low" | "unknown" }) {
  if (input.liquidity === "high" && (input.spreadPct ?? 9) <= 0.08) return "Скальпинг: хорошо";
  if (input.liquidity !== "low" && (input.spreadPct ?? 9) <= 0.18) return "Интрадей: рабочий";
  if (input.turnoverPerTrade !== null && input.turnoverPerTrade < 40_000) return "Внимание: мелкий поток";
  return "Нужна осторожность";
}

function buildStockRows(payload: ReturnType<typeof moexIssPayloadSchema.parse>): TechnicalCharacteristicsRow[] {
  const marketByTicker = new Map<string, TableRow>();
  for (const raw of payload.marketdata.data) {
    const market = rowToObject(payload.marketdata.columns, raw);
    const ticker = asString(market.SECID);
    if (ticker) marketByTicker.set(ticker, market);
  }

  const rows: TechnicalCharacteristicsRow[] = [];
  for (const raw of payload.securities.data) {
    const sec = rowToObject(payload.securities.columns, raw);
    const ticker = asString(sec.SECID);
    if (!ticker) continue;
    const market = marketByTicker.get(ticker);
    if (!market) continue;

    const lotSize = asNumber(sec.LOTSIZE);
    const last = asNumber(market.LAST);
    const step = asNumber(sec.MINSTEP);
    const stepValueDerived = step !== null && lotSize !== null ? step * lotSize : null;
    const lotPrice = last !== null && lotSize !== null ? last * lotSize : null;
    const turnover = asNumber(market.VALTODAY);
    const commission = lotPrice !== null ? lotPrice * STOCK_COMMISSION_RATE : null;
    const stepValueForCalc = stepValueDerived;

    const spreadPctValue = spreadPct(asNumber(market.BID), asNumber(market.OFFER), last);
    const spreadRub = spreadPctValue !== null && last !== null ? (spreadPctValue / 100) * last : null;
    const spreadTicks = spreadRub !== null && step !== null && step > 0 ? spreadRub / step : null;
    const turnoverPerTrade = turnover !== null && asNumber(market.NUMTRADES) !== null && asNumber(market.NUMTRADES)! > 0 ? turnover / asNumber(market.NUMTRADES)! : null;
    const dayRangePct = asNumber(market.HIGH) !== null && asNumber(market.LOW) !== null && last !== null && last > 0 ? ((asNumber(market.HIGH)! - asNumber(market.LOW)!) / last) * 100 : null;
    const commissionToRangeScore = commission !== null && dayRangePct !== null && dayRangePct > 0 ? Math.max(0, 100 - (commission / (lotPrice ?? 1) / (dayRangePct / 100)) * 100) : null;
    const slip = spreadPctValue !== null && turnoverPerTrade !== null && turnoverPerTrade > 0 ? spreadPctValue * (200_000 / turnoverPerTrade) : null;
    const liq = liquidityQuality(turnover, asNumber(market.NUMTRADES));
    const usability =
      spreadPctValue !== null && turnover !== null && asNumber(market.NUMTRADES) !== null
        ? Math.max(0, Math.min(100, 100 - spreadPctValue * 220 + Math.log10(Math.max(turnover, 1)) * 7 + Math.log10(Math.max(asNumber(market.NUMTRADES)!, 1)) * 8))
        : null;

    const draftRow: TechnicalCharacteristicsRow = {
      ticker,
      instrumentName: asString(sec.SHORTNAME) ?? ticker,
      assetClass: "stock",
      board: asString(sec.BOARDID),
      market: asString(sec.MARKETID),
      lotSize: valueWithStatus(lotSize),
      priceStep: valueWithStatus(step),
      stepValue: valueWithStatus(stepValueDerived, "derived", "Расчет: шаг цены × размер лота"),
      currentPrice: valueWithStatus(last),
      lotPrice: valueWithStatus(lotPrice, "derived", "Расчет: текущая цена × размер лота"),
      spreadPct: valueWithStatus(spreadPctValue, "derived"),
      spreadRub: valueWithStatus(spreadRub, "derived", "Оценка: спред % × текущая цена"),
      spreadTicks: valueWithStatus(spreadTicks, "derived", "Оценка: спред в рублях / шаг цены"),
      tradesCount: valueWithStatus(asNumber(market.NUMTRADES)),
      turnoverRub: valueWithStatus(turnover),
      turnoverPerTradeRub: valueWithStatus(turnoverPerTrade, "derived", "Оборот / количество сделок"),
      largeLotRub: valueWithStatus(turnover !== null ? turnover * 0.01 : null, "derived", "1% от внутридневного оборота"),
      commissionRub: valueWithStatus(commission, "derived", "Оценка одной транзакции одним лотом"),
      pointsToCoverCommission: valueWithStatus(
        commission !== null && stepValueForCalc !== null && stepValueForCalc > 0 ? commission / stepValueForCalc : null,
        "derived",
        "Комиссия / стоимость шага",
      ),
      rublesToCoverCommission: valueWithStatus(commission, "derived", "Необходимое движение в рублях на лот"),
      slippageSensitivity: valueWithStatus(slip, "derived", "Прокси: чем ниже, тем устойчивее к проскальзыванию"),
      commissionToRangeScore: valueWithStatus(commissionToRangeScore, "derived", "Баланс комиссии к внутридневному диапазону"),
      intradayUsabilityScore: valueWithStatus(usability, "derived", "Интегральная пригодность для intraday"),
      underlying: null,
      expiryDate: null,
      daysToExpiry: valueWithStatus(null, "available", "Для акций неприменимо"),
      contractSize: valueWithStatus(null, "available", "Для акций неприменимо"),
      marginFootprintRub: valueWithStatus(null, "available", "Требуется отдельный источник гарантийного обеспечения"),
      liquidityQuality: liq,
      scalabilityHint: scalabilityHint({ spreadPct: spreadPctValue, turnoverPerTrade, liquidity: liq }),
      availabilityConfidence: 0,
      sourceMeta: {
        source: "moex",
        sourceUpdatedAt: null,
      },
    };
    draftRow.availabilityConfidence = availabilityConfidence(draftRow);
    rows.push(draftRow);
  }
  return rows;
}

function buildFuturesRows(payload: ReturnType<typeof moexIssPayloadSchema.parse>): TechnicalCharacteristicsRow[] {
  const marketByTicker = new Map<string, TableRow>();
  for (const raw of payload.marketdata.data) {
    const market = rowToObject(payload.marketdata.columns, raw);
    const ticker = asString(market.SECID);
    if (ticker) marketByTicker.set(ticker, market);
  }

  const rows: TechnicalCharacteristicsRow[] = [];
  for (const raw of payload.securities.data) {
    const sec = rowToObject(payload.securities.columns, raw);
    const ticker = asString(sec.SECID);
    if (!ticker) continue;
    const market = marketByTicker.get(ticker);
    if (!market) continue;

    const lotSize = asNumber(sec.LOTSIZE);
    const last = asNumber(market.LAST);
    const step = asNumber(sec.MINSTEP);
    const stepValueRaw = asNumber(sec.STEPPRICE);
    const stepValueFallback = step !== null && lotSize !== null ? step * lotSize : null;
    const stepValue = stepValueRaw ?? stepValueFallback;
    const lotPrice = last !== null && lotSize !== null ? last * lotSize : null;
    const turnover = asNumber(market.VALTODAY);
    const commission = lotPrice !== null ? lotPrice * FUTURES_COMMISSION_RATE : null;

    const spreadPctValue = spreadPct(asNumber(market.BID), asNumber(market.OFFER), last);
    const spreadRub = spreadPctValue !== null && last !== null ? (spreadPctValue / 100) * last : null;
    const spreadTicks = spreadRub !== null && step !== null && step > 0 ? spreadRub / step : null;
    const trades = asNumber(market.NUMTRADES);
    const turnoverPerTrade = turnover !== null && trades !== null && trades > 0 ? turnover / trades : null;
    const dayRangePct = asNumber(market.HIGH) !== null && asNumber(market.LOW) !== null && last !== null && last > 0 ? ((asNumber(market.HIGH)! - asNumber(market.LOW)!) / last) * 100 : null;
    const commissionToRangeScore = commission !== null && dayRangePct !== null && dayRangePct > 0 ? Math.max(0, 100 - (commission / (lotPrice ?? 1) / (dayRangePct / 100)) * 100) : null;
    const slip = spreadPctValue !== null && turnoverPerTrade !== null && turnoverPerTrade > 0 ? spreadPctValue * (200_000 / turnoverPerTrade) : null;
    const liq = liquidityQuality(turnover, trades);
    const usability =
      spreadPctValue !== null && turnover !== null && trades !== null
        ? Math.max(0, Math.min(100, 100 - spreadPctValue * 220 + Math.log10(Math.max(turnover, 1)) * 7 + Math.log10(Math.max(trades, 1)) * 8))
        : null;
    const expiry = asString(sec.LASTDELDATE);
    const dte = daysToExpiry(expiry);

    const draftRow: TechnicalCharacteristicsRow = {
      ticker,
      instrumentName: asString(sec.SHORTNAME) ?? ticker,
      assetClass: "future",
      board: asString(sec.BOARDID),
      market: asString(sec.MARKETID),
      lotSize: valueWithStatus(lotSize),
      priceStep: valueWithStatus(step),
      stepValue: valueWithStatus(stepValue, stepValueRaw !== null ? "available" : "derived", stepValueRaw !== null ? undefined : "Fallback: шаг цены × размер контракта"),
      currentPrice: valueWithStatus(last),
      lotPrice: valueWithStatus(lotPrice, "derived", "Расчет: текущая цена × размер контракта"),
      spreadPct: valueWithStatus(spreadPctValue, "derived"),
      spreadRub: valueWithStatus(spreadRub, "derived", "Оценка: спред % × текущая цена"),
      spreadTicks: valueWithStatus(spreadTicks, "derived", "Оценка: спред в рублях / шаг цены"),
      tradesCount: valueWithStatus(trades),
      turnoverRub: valueWithStatus(turnover),
      turnoverPerTradeRub: valueWithStatus(turnoverPerTrade, "derived", "Оборот / количество сделок"),
      largeLotRub: valueWithStatus(turnover !== null ? turnover * 0.01 : null, "derived", "1% от внутридневного оборота"),
      commissionRub: valueWithStatus(commission, "derived", "Оценка одной транзакции одним контрактом"),
      pointsToCoverCommission: valueWithStatus(
        commission !== null && stepValue !== null && stepValue > 0 ? commission / stepValue : null,
        "derived",
        "Комиссия / стоимость шага",
      ),
      rublesToCoverCommission: valueWithStatus(commission, "derived", "Необходимое движение в рублях на контракт"),
      slippageSensitivity: valueWithStatus(slip, "derived", "Прокси: чем ниже, тем устойчивее к проскальзыванию"),
      commissionToRangeScore: valueWithStatus(commissionToRangeScore, "derived", "Баланс комиссии к внутридневному диапазону"),
      intradayUsabilityScore: valueWithStatus(usability, "derived", "Интегральная пригодность для intraday"),
      underlying: asString(sec.ASSETCODE),
      expiryDate: expiry,
      daysToExpiry: valueWithStatus(dte, "derived", "Календарные дни до экспирации"),
      contractSize: valueWithStatus(lotSize),
      marginFootprintRub: valueWithStatus(null, "available", "Требуется API по ГО/риск-параметрам"),
      liquidityQuality: liq,
      scalabilityHint: scalabilityHint({ spreadPct: spreadPctValue, turnoverPerTrade, liquidity: liq }),
      availabilityConfidence: 0,
      sourceMeta: {
        source: "moex",
        sourceUpdatedAt: null,
      },
    };
    draftRow.availabilityConfidence = availabilityConfidence(draftRow);
    rows.push(draftRow);
  }
  return rows;
}

function sortByUtility(rows: TechnicalCharacteristicsRow[]) {
  return [...rows].sort((a, b) => {
    const turnoverA = a.turnoverRub.value ?? -1;
    const turnoverB = b.turnoverRub.value ?? -1;
    return turnoverB - turnoverA;
  });
}

function applyLiquidFilter(rows: TechnicalCharacteristicsRow[], liquidOnly: boolean) {
  if (!liquidOnly) return rows;
  return rows.filter((row) => {
    if (row.assetClass === "future") return true;
    return classifyStockLiquidity({ ticker: row.ticker, turnover: row.turnoverRub.value, tradesCount: row.tradesCount.value }) === "liquid";
  });
}

export async function getTechnicalCharacteristics(params: {
  assetClass: "all" | "stock" | "future";
  liquidOnly: boolean;
}): Promise<TechnicalCharacteristicsResponse> {
  const now = Date.now();
  if (lastSnapshot && now < lastSnapshot.expiresAt) {
    const filtered = filterRows(lastSnapshot.payload.rows, params.assetClass, params.liquidOnly);
    return {
      rows: filtered,
      status: { ...lastSnapshot.payload.status, rows: filtered.length },
    };
  }

  const fetchTimestamp = new Date().toISOString();
  const [stocksPayload, futuresPayload] = await Promise.all([
    fetchIssJson(
      "/engines/stock/markets/shares/boards/TQBR/securities.json?iss.meta=off&iss.only=securities,marketdata&securities.columns=SECID,SHORTNAME,LOTSIZE,BOARDID,MARKETID,MINSTEP&marketdata.columns=SECID,LAST,BID,OFFER,NUMTRADES,VALTODAY,HIGH,LOW",
    ),
    fetchIssJson(
      "/engines/futures/markets/forts/securities.json?iss.meta=off&iss.only=securities,marketdata&securities.columns=SECID,SHORTNAME,LOTSIZE,BOARDID,MARKETID,MINSTEP,STEPPRICE,LASTDELDATE,ASSETCODE&marketdata.columns=SECID,LAST,BID,OFFER,NUMTRADES,VALTODAY,OPENPOSITION,HIGH,LOW",
    ),
  ]);

  const stockRows = buildStockRows(moexIssPayloadSchema.parse(stocksPayload));
  const futureRows = buildFuturesRows(moexIssPayloadSchema.parse(futuresPayload));
  const combinedRows = sortByUtility([...stockRows, ...futureRows]);

  const snapshotPayload: TechnicalCharacteristicsResponse = {
    rows: combinedRows,
    status: {
      source: "moex",
      fetchTimestamp,
      sourceTimestamp: fetchTimestamp,
      rows: combinedRows.length,
      message: "MOEX ISS online",
    },
  };
  lastSnapshot = {
    expiresAt: now + CACHE_TTL_MS,
    payload: snapshotPayload,
  };

  const filtered = filterRows(combinedRows, params.assetClass, params.liquidOnly);
  return {
    rows: filtered,
    status: { ...snapshotPayload.status, rows: filtered.length },
  };
}

function filterRows(rows: TechnicalCharacteristicsRow[], assetClass: "all" | "stock" | "future", liquidOnly: boolean) {
  const classFiltered = assetClass === "all" ? rows : rows.filter((row) => row.assetClass === assetClass);
  return applyLiquidFilter(classFiltered, liquidOnly);
}
