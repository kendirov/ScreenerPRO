const ENDPOINTS = {
  binance24h: "https://fapi.binance.com/fapi/v1/ticker/24hr",
  binancePremium: "https://fapi.binance.com/fapi/v1/premiumIndex",
  binanceBook: "https://fapi.binance.com/fapi/v1/ticker/bookTicker",
  bybitTickers: "https://api.bybit.com/v5/market/tickers?category=linear",
  okxTickers: "https://www.okx.com/api/v5/market/tickers?instType=SWAP",
  bitgetTickers: "https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES",
};

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round = (value, digits = 2) => value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
const median = (values) => {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
};
const mean = (values) => {
  const clean = values.filter((v) => Number.isFinite(v));
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
};

async function fetchJson(url, timeoutMs = 15_000) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "ScreenerPRO/crypto-radar" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function safeFetch(name, url) {
  try {
    return { ok: true, name, data: await fetchJson(url) };
  } catch (error) {
    return { ok: false, name, error: error instanceof Error ? error.message : String(error) };
  }
}

function spreadBps(bid, ask) {
  if (!(bid > 0) || !(ask >= bid)) return null;
  const mid = (bid + ask) / 2;
  return ((ask - bid) / mid) * 10_000;
}

function put(map, base, exchange, payload) {
  if (!base || !payload) return;
  const row = map.get(base) ?? { base };
  row[exchange] = payload;
  map.set(base, row);
}

function normalizeBulk(results) {
  const universe = new Map();
  const errors = results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.error}`);
  const byName = Object.fromEntries(results.map((r) => [r.name, r]));

  if (byName.binance24h?.ok) {
    const premium = new Map();
    if (byName.binancePremium?.ok && Array.isArray(byName.binancePremium.data)) {
      for (const row of byName.binancePremium.data) premium.set(row.symbol, row);
    }
    const books = new Map();
    if (byName.binanceBook?.ok && Array.isArray(byName.binanceBook.data)) {
      for (const row of byName.binanceBook.data) books.set(row.symbol, row);
    }
    for (const row of byName.binance24h.data ?? []) {
      const symbol = String(row.symbol ?? "");
      if (!/^[A-Z0-9]+USDT$/.test(symbol)) continue;
      const base = symbol.slice(0, -4);
      const p = premium.get(symbol) ?? {};
      const book = books.get(symbol) ?? {};
      put(universe, base, "binance", {
        symbol,
        last: num(row.lastPrice),
        change24hPct: num(row.priceChangePercent),
        high24h: num(row.highPrice),
        low24h: num(row.lowPrice),
        turnover24h: num(row.quoteVolume),
        fundingRate: num(p.lastFundingRate),
        bid: num(book.bidPrice),
        ask: num(book.askPrice),
        spreadBps: spreadBps(num(book.bidPrice), num(book.askPrice)),
      });
    }
  }

  if (byName.bybitTickers?.ok) {
    const list = byName.bybitTickers.data?.result?.list ?? [];
    for (const row of list) {
      const symbol = String(row.symbol ?? "");
      if (!/^[A-Z0-9]+USDT$/.test(symbol)) continue;
      const base = symbol.slice(0, -4);
      put(universe, base, "bybit", {
        symbol,
        last: num(row.lastPrice),
        change24hPct: num(row.price24hPcnt) == null ? null : num(row.price24hPcnt) * 100,
        high24h: num(row.highPrice24h),
        low24h: num(row.lowPrice24h),
        turnover24h: num(row.turnover24h),
        fundingRate: num(row.fundingRate),
        openInterestUsd: num(row.openInterestValue),
        bid: num(row.bid1Price),
        ask: num(row.ask1Price),
        spreadBps: spreadBps(num(row.bid1Price), num(row.ask1Price)),
      });
    }
  }

  if (byName.okxTickers?.ok) {
    for (const row of byName.okxTickers.data?.data ?? []) {
      const match = String(row.instId ?? "").match(/^([A-Z0-9]+)-USDT-SWAP$/);
      if (!match) continue;
      const base = match[1];
      const last = num(row.last);
      const open24h = num(row.open24h);
      put(universe, base, "okx", {
        symbol: row.instId,
        last,
        change24hPct: last != null && open24h > 0 ? ((last / open24h) - 1) * 100 : null,
        high24h: num(row.high24h),
        low24h: num(row.low24h),
        bid: num(row.bidPx),
        ask: num(row.askPx),
        spreadBps: spreadBps(num(row.bidPx), num(row.askPx)),
      });
    }
  }

  if (byName.bitgetTickers?.ok) {
    for (const row of byName.bitgetTickers.data?.data ?? []) {
      const symbol = String(row.symbol ?? "");
      if (!/^[A-Z0-9]+USDT$/.test(symbol)) continue;
      const base = symbol.slice(0, -4);
      const last = num(row.lastPr);
      const open24h = num(row.open24h);
      put(universe, base, "bitget", {
        symbol,
        last,
        change24hPct: last != null && open24h > 0 ? ((last / open24h) - 1) * 100 : (num(row.change24h) == null ? null : num(row.change24h) * 100),
        high24h: num(row.high24h),
        low24h: num(row.low24h),
        turnover24h: num(row.usdtVolume) ?? num(row.quoteVolume),
        fundingRate: num(row.fundingRate),
        openInterestCoin: num(row.holdingAmount),
        bid: num(row.bidPr),
        ask: num(row.askPr),
        spreadBps: spreadBps(num(row.bidPr), num(row.askPr)),
      });
    }
  }

  return { universe, errors };
}

function baseMetrics(row) {
  const radar = [row.binance, row.bybit, row.okx].filter(Boolean);
  const radarChanges = radar.map((x) => x.change24hPct).filter(Number.isFinite);
  const change24hPct = median(radarChanges);
  const sameSign = change24hPct == null ? 0 : radarChanges.filter((v) => Math.sign(v) === Math.sign(change24hPct)).length;
  const consensus24 = radarChanges.length ? sameSign / radarChanges.length : 0;
  const volumes = [row.binance?.turnover24h, row.bybit?.turnover24h, row.bitget?.turnover24h].filter((v) => v > 0);
  const turnover24h = median(volumes);
  const fundingRate = median([row.binance?.fundingRate, row.bybit?.fundingRate, row.bitget?.fundingRate]);
  const bitgetSpreadBps = row.bitget?.spreadBps ?? null;
  const liquidityScore = turnover24h > 0 ? clamp(25 * Math.log10(turnover24h / 1_000_000 + 1)) : 0;
  const spreadScore = bitgetSpreadBps == null ? 50 : clamp(100 - bitgetSpreadBps * 4);
  return {
    radarCount: radar.length,
    change24hPct,
    consensus24,
    turnover24h,
    fundingRate,
    bitgetSpreadBps,
    liquidityScore,
    spreadScore,
  };
}

function preliminaryScore(row) {
  const m = baseMetrics(row);
  const move = clamp(Math.abs(m.change24hPct ?? 0) / 12 * 100);
  const funding = clamp(Math.abs(m.fundingRate ?? 0) / 0.001 * 100);
  return move * 0.35 + m.liquidityScore * 0.35 + funding * 0.15 + m.consensus24 * 15;
}

function normalizeCandles(raw, exchange) {
  let rows = [];
  if (exchange === "binance" && Array.isArray(raw)) {
    rows = raw.map((r) => ({ t: num(r[0]), o: num(r[1]), h: num(r[2]), l: num(r[3]), c: num(r[4]), turnover: num(r[7]) }));
  } else if (exchange === "bybit") {
    rows = (raw?.result?.list ?? []).map((r) => ({ t: num(r[0]), o: num(r[1]), h: num(r[2]), l: num(r[3]), c: num(r[4]), turnover: num(r[6]) }));
  }
  return rows.filter((r) => r.t && r.c > 0 && r.h > 0 && r.l > 0).sort((a, b) => a.t - b.t);
}

function candleStats(rows) {
  if (rows.length < 16) return null;
  const last = rows.at(-1);
  const at = (n) => rows.at(-1 - n)?.c ?? null;
  const ret = (bars) => at(bars) ? ((last.c / at(bars)) - 1) * 100 : null;
  const recentVol = mean(rows.slice(-3).map((r) => r.turnover).filter((v) => v > 0));
  const priorVol = mean(rows.slice(-15, -3).map((r) => r.turnover).filter((v) => v > 0));
  const volAccel = recentVol != null && priorVol > 0 ? recentVol / priorVol : null;
  const priorWindow = rows.slice(-27, -3);
  const priorHigh = Math.max(...priorWindow.map((r) => r.h));
  const priorLow = Math.min(...priorWindow.map((r) => r.l));
  const distHighPct = priorHigh > 0 ? ((priorHigh - last.c) / last.c) * 100 : null;
  const distLowPct = priorLow > 0 ? ((last.c - priorLow) / last.c) * 100 : null;
  const breakout = last.c > priorHigh ? 1 : last.c < priorLow ? -1 : 0;
  const rangePct = (r) => ((r.h - r.l) / r.c) * 100;
  const recentRange = mean(rows.slice(-6).map(rangePct));
  const oldRange = mean(rows.slice(-24, -6).map(rangePct));
  const compressionRatio = recentRange != null && oldRange > 0 ? recentRange / oldRange : null;
  const rangePosition = priorHigh > priorLow ? (last.c - priorLow) / (priorHigh - priorLow) : 0.5;
  return {
    ret15Pct: ret(3),
    ret60Pct: ret(12),
    volAccel,
    distHighPct,
    distLowPct,
    breakout,
    compressionRatio,
    rangePosition,
  };
}

function oiChangeBinance(raw) {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const vals = raw.map((r) => num(r.sumOpenInterestValue) ?? num(r.sumOpenInterest)).filter((v) => v > 0);
  return vals.length >= 2 ? ((vals.at(-1) / vals[0]) - 1) * 100 : null;
}
function oiChangeBybit(raw) {
  const list = (raw?.result?.list ?? []).map((r) => ({ t: num(r.timestamp), v: num(r.openInterest) })).filter((r) => r.t && r.v > 0).sort((a, b) => a.t - b.t);
  return list.length >= 2 ? ((list.at(-1).v / list[0].v) - 1) * 100 : null;
}

async function detailFor(row) {
  const tasks = [];
  if (row.binance) {
    const s = row.binance.symbol;
    tasks.push(safeFetch("binanceKline", `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(s)}&interval=5m&limit=48`));
    tasks.push(safeFetch("binanceOi", `https://fapi.binance.com/futures/data/openInterestHist?symbol=${encodeURIComponent(s)}&period=5m&limit=12`));
  }
  if (row.bybit) {
    const s = row.bybit.symbol;
    tasks.push(safeFetch("bybitKline", `https://api.bybit.com/v5/market/kline?category=linear&symbol=${encodeURIComponent(s)}&interval=5&limit=48`));
    tasks.push(safeFetch("bybitOi", `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${encodeURIComponent(s)}&intervalTime=5min&limit=12`));
  }
  const results = await Promise.all(tasks);
  const by = Object.fromEntries(results.map((r) => [r.name, r]));
  const bk = by.binanceKline?.ok ? candleStats(normalizeCandles(by.binanceKline.data, "binance")) : null;
  const yk = by.bybitKline?.ok ? candleStats(normalizeCandles(by.bybitKline.data, "bybit")) : null;
  const ret15Pct = median([bk?.ret15Pct, yk?.ret15Pct]);
  const ret60Pct = median([bk?.ret60Pct, yk?.ret60Pct]);
  const volAccel = median([bk?.volAccel, yk?.volAccel]);
  const compressionRatio = median([bk?.compressionRatio, yk?.compressionRatio]);
  const rangePosition = median([bk?.rangePosition, yk?.rangePosition]);
  const distHighPct = median([bk?.distHighPct, yk?.distHighPct]);
  const distLowPct = median([bk?.distLowPct, yk?.distLowPct]);
  const breakouts = [bk?.breakout, yk?.breakout].filter(Number.isFinite);
  const breakout = breakouts.length ? Math.sign(breakouts.reduce((a, b) => a + b, 0)) : 0;
  const oiChangePct = median([
    by.binanceOi?.ok ? oiChangeBinance(by.binanceOi.data) : null,
    by.bybitOi?.ok ? oiChangeBybit(by.bybitOi.data) : null,
  ]);
  return { ret15Pct, ret60Pct, volAccel, compressionRatio, rangePosition, distHighPct, distLowPct, breakout, oiChangePct };
}

async function mapLimit(items, limit, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

function scoreDetailed(row, detail) {
  const b = baseMetrics(row);
  const volPower = detail.volAccel == null ? 20 : clamp(((detail.volAccel - 1) / 3) * 100);
  const oiAbs = detail.oiChangePct == null ? 15 : clamp(Math.abs(detail.oiChangePct) / 10 * 100);
  const oiGrowth = detail.oiChangePct == null ? 15 : clamp(detail.oiChangePct / 8 * 100);
  const move15 = detail.ret15Pct == null ? 0 : clamp(Math.abs(detail.ret15Pct) / 3 * 100);
  const move60 = detail.ret60Pct == null ? 0 : clamp(Math.abs(detail.ret60Pct) / 8 * 100);
  const compression = detail.compressionRatio == null ? 30 : clamp(((1 - detail.compressionRatio) / 0.5) * 100);
  const nearestBoundary = Math.min(Math.abs(detail.distHighPct ?? 99), Math.abs(detail.distLowPct ?? 99));
  const proximity = detail.breakout ? 100 : clamp((2 - nearestBoundary) / 2 * 100);
  const fundingExtreme = clamp(Math.abs(b.fundingRate ?? 0) / 0.001 * 100);
  const shortConsensus = detail.ret15Pct == null || detail.ret60Pct == null ? 0.5 : (Math.sign(detail.ret15Pct) === Math.sign(detail.ret60Pct) ? 1 : 0.35);

  const momentum = clamp(move60 * 0.32 + volPower * 0.24 + oiAbs * 0.18 + b.consensus24 * 12 + b.liquidityScore * 0.14);
  const ignition = clamp(volPower * 0.28 + move15 * 0.22 + proximity * 0.20 + oiAbs * 0.15 + compression * 0.08 + shortConsensus * 7);
  const prebreakout = clamp(compression * 0.30 + proximity * 0.30 + volPower * 0.17 + oiGrowth * 0.13 + b.liquidityScore * 0.10);

  let squeezeDirection = null;
  let resilience = 20;
  if ((b.fundingRate ?? 0) >= 0.0003 && (detail.oiChangePct ?? 0) > 1.5) {
    squeezeDirection = "SHORT";
    resilience = clamp((0.75 - (detail.ret15Pct ?? 0)) / 1.5 * 100);
  } else if ((b.fundingRate ?? 0) <= -0.0003 && (detail.oiChangePct ?? 0) > 1.5) {
    squeezeDirection = "LONG";
    resilience = clamp(((detail.ret15Pct ?? 0) + 0.75) / 1.5 * 100);
  }
  const squeeze = clamp(fundingExtreme * 0.40 + oiGrowth * 0.27 + resilience * 0.18 + b.liquidityScore * 0.15);

  const directional = median([detail.ret15Pct, detail.ret60Pct, b.change24hPct]);
  let trendDirection = directional == null ? "NEUTRAL" : directional > 0 ? "LONG" : directional < 0 ? "SHORT" : "NEUTRAL";
  let preDirection = trendDirection;
  if ((detail.rangePosition ?? 0.5) >= 0.67) preDirection = "LONG";
  if ((detail.rangePosition ?? 0.5) <= 0.33) preDirection = "SHORT";

  const categories = [
    { type: "IGNITION", score: ignition, direction: trendDirection },
    { type: "PRE-BREAKOUT", score: prebreakout, direction: preDirection },
    { type: "MOMENTUM", score: momentum, direction: trendDirection },
    { type: "SQUEEZE", score: squeeze, direction: squeezeDirection ?? trendDirection },
  ].sort((a, c) => c.score - a.score);
  const primary = categories[0];
  const executionPenalty = 0.65 + (b.spreadScore / 100) * 0.35;
  const overall = clamp(primary.score * executionPenalty);

  const reasons = [];
  if ((detail.volAccel ?? 0) >= 1.8) reasons.push(`volume x${round(detail.volAccel, 1)}`);
  if (Math.abs(detail.oiChangePct ?? 0) >= 2) reasons.push(`OI ${detail.oiChangePct > 0 ? "+" : ""}${round(detail.oiChangePct, 1)}%/≈1h`);
  if (Math.abs(b.fundingRate ?? 0) >= 0.0003) reasons.push(`funding ${round((b.fundingRate ?? 0) * 100, 3)}%`);
  if (detail.breakout) reasons.push(detail.breakout > 0 ? "5m breakout up" : "5m breakout down");
  else if (nearestBoundary <= 1) reasons.push(`до границы ≈${round(nearestBoundary, 2)}%`);
  if ((detail.compressionRatio ?? 1) <= 0.7) reasons.push("сжатие диапазона");
  if (b.consensus24 >= 2 / 3) reasons.push("2+/3 бирж согласны");
  if ((b.bitgetSpreadBps ?? 99) <= 8) reasons.push("узкий Bitget spread");

  return {
    symbol: `${row.base}USDT`,
    base: row.base,
    primaryType: primary.type,
    direction: primary.direction,
    overallScore: round(overall, 1),
    scores: {
      ignition: round(ignition, 1),
      prebreakout: round(prebreakout, 1),
      momentum: round(momentum, 1),
      squeeze: round(squeeze, 1),
      liquidity: round(b.liquidityScore, 1),
    },
    metrics: {
      change24hPct: round(b.change24hPct, 2),
      ret15Pct: round(detail.ret15Pct, 2),
      ret60Pct: round(detail.ret60Pct, 2),
      volumeAcceleration: round(detail.volAccel, 2),
      oiChangeApprox1hPct: round(detail.oiChangePct, 2),
      fundingRatePct: round((b.fundingRate ?? 0) * 100, 4),
      medianTurnover24hUsd: round(b.turnover24h, 0),
      bitgetSpreadBps: round(b.bitgetSpreadBps, 2),
      radarCount: b.radarCount,
      consensus24: round(b.consensus24, 2),
      rangePosition: round(detail.rangePosition, 2),
      compressionRatio: round(detail.compressionRatio, 2),
    },
    exchanges: {
      binance: Boolean(row.binance),
      bybit: Boolean(row.bybit),
      okx: Boolean(row.okx),
      bitget: Boolean(row.bitget),
    },
    reasons: reasons.slice(0, 5),
  };
}

function topBy(scored, key, n = 8) {
  return scored.slice().sort((a, b) => (b.scores[key] ?? 0) - (a.scores[key] ?? 0)).slice(0, n);
}

const bulk = await Promise.all([
  safeFetch("binance24h", ENDPOINTS.binance24h),
  safeFetch("binancePremium", ENDPOINTS.binancePremium),
  safeFetch("binanceBook", ENDPOINTS.binanceBook),
  safeFetch("bybitTickers", ENDPOINTS.bybitTickers),
  safeFetch("okxTickers", ENDPOINTS.okxTickers),
  safeFetch("bitgetTickers", ENDPOINTS.bitgetTickers),
]);

const { universe, errors } = normalizeBulk(bulk);
const eligible = [...universe.values()]
  .filter((row) => row.bitget)
  .filter((row) => [row.binance, row.bybit, row.okx].filter(Boolean).length >= 2)
  .filter((row) => (baseMetrics(row).turnover24h ?? 0) >= 2_000_000)
  .sort((a, b) => preliminaryScore(b) - preliminaryScore(a));

const pool = eligible.slice(0, 28);
const detailed = await mapLimit(pool, 4, async (row) => ({ row, detail: await detailFor(row) }));
const scored = detailed.map(({ row, detail }) => scoreDetailed(row, detail))
  .filter((row) => row.metrics.bitgetSpreadBps == null || row.metrics.bitgetSpreadBps <= 60)
  .sort((a, b) => b.overallScore - a.overallScore);

const report = {
  asOf: new Date().toISOString(),
  source: "public APIs: Binance USD-M + Bybit linear + OKX USDT swaps; execution filter: Bitget USDT futures",
  methodologyVersion: "explosion-score-v0.2",
  status: {
    bulkErrors: errors,
    universeCount: universe.size,
    eligibleOnBitgetAnd2PlusRadarExchanges: eligible.length,
    detailedPoolSize: pool.length,
  },
  topOverall: scored.slice(0, 12),
  topIgnition: topBy(scored, "ignition"),
  topPreBreakout: topBy(scored, "prebreakout"),
  topSqueeze: topBy(scored, "squeeze"),
  topMomentum: topBy(scored, "momentum"),
  topLiquidity: topBy(scored, "liquidity"),
  notes: [
    "OI trend uses Binance/Bybit 5m history where available; current OKX and Bitget data are used for cross-exchange confirmation/execution filtering.",
    "Scores rank attention, not certainty. Entry still requires a trigger and invalidation level.",
    "Funding is a crowding signal, not a directional forecast by itself.",
  ],
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
