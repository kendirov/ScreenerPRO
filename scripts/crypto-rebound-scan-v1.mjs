const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const round = (v, d = 2) => v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d));
const mean = (xs) => { const a = xs.filter(Number.isFinite); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const median = (xs) => { const a = xs.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

async function get(url) {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'ScreenerPRO/rebound-v1' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}
function spreadBps(bid, ask) { if (!(bid > 0) || !(ask >= bid)) return null; const mid = (bid + ask) / 2; return (ask - bid) / mid * 10000; }
function rsi(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;
  const tail = closes.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < tail.length; i++) {
    const d = tail[i] - tail[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}
function aggregateBars(rows, size) {
  const out = [];
  for (let i = 0; i + size <= rows.length; i += size) {
    const g = rows.slice(i, i + size);
    out.push({
      t: g[0].t,
      o: g[0].o,
      h: Math.max(...g.map(x => x.h)),
      l: Math.min(...g.map(x => x.l)),
      c: g.at(-1).c,
      v: g.reduce((s, x) => s + (x.v ?? 0), 0),
    });
  }
  return out;
}
function normalizeBitget(raw) {
  return (raw?.data ?? raw ?? []).map(x => ({ t: num(x[0]), o: num(x[1]), h: num(x[2]), l: num(x[3]), c: num(x[4]), v: num(x[6]) ?? num(x[5]) })).filter(x => x.t && x.c > 0).sort((a, b) => a.t - b.t);
}
function normalizeOkx(raw) {
  return (raw?.data ?? []).map(x => ({ t: num(x[0]), o: num(x[1]), h: num(x[2]), l: num(x[3]), c: num(x[4]), v: num(x[7]) ?? num(x[5]) })).filter(x => x.t && x.c > 0).sort((a, b) => a.t - b.t);
}
function candleStats(a) {
  if (a.length < 170) return null;
  const last = a.at(-1);
  const at = n => a.at(-1 - n)?.c;
  const ret = n => at(n) ? (last.c / at(n) - 1) * 100 : null;
  const recentVol = mean(a.slice(-3).map(x => x.v).filter(v => v > 0));
  const priorVol = mean(a.slice(-27, -3).map(x => x.v).filter(v => v > 0));
  const volAccel = recentVol != null && priorVol > 0 ? recentVol / priorVol : null;
  const prior = a.slice(-51, -3);
  const priorHigh = Math.max(...prior.map(x => x.h));
  const priorLow = Math.min(...prior.map(x => x.l));
  const localLow = Math.min(...a.slice(-24).map(x => x.l));
  const localHigh = Math.max(...a.slice(-12).map(x => x.h));
  const recentRange = mean(a.slice(-6).map(x => (x.h - x.l) / x.c * 100));
  const oldRange = mean(a.slice(-30, -6).map(x => (x.h - x.l) / x.c * 100));
  const m15 = aggregateBars(a.slice(-(Math.floor(a.length / 3) * 3)), 3);
  const h1 = aggregateBars(a.slice(-(Math.floor(a.length / 12) * 12)), 12);
  return {
    ret15Pct: ret(3), ret60Pct: ret(12), ret240Pct: ret(48),
    volAccel,
    compression: recentRange != null && oldRange > 0 ? recentRange / oldRange : null,
    priorHigh, priorLow, localLow, localHigh,
    rangePosition: priorHigh > priorLow ? (last.c - priorLow) / (priorHigh - priorLow) : .5,
    rsi5m: rsi(a.map(x => x.c)), rsi15m: rsi(m15.map(x => x.c)), rsi1h: rsi(h1.map(x => x.c)),
    last: last.c,
  };
}
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let cursor = 0;
  async function worker() { while (cursor < items.length) { const i = cursor++; out[i] = await fn(items[i]); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)); return out;
}

const [instrumentBody, bitgetBody, okxBody] = await Promise.all([
  get('https://api.bitget.com/api/v3/market/instruments?category=USDT-FUTURES'),
  get('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES'),
  get('https://www.okx.com/api/v5/market/tickers?instType=SWAP'),
]);
if (instrumentBody.code !== '00000' || !Array.isArray(instrumentBody.data)) throw new Error('Bitget instruments failed');
if (bitgetBody.code !== '00000' || !Array.isArray(bitgetBody.data)) throw new Error('Bitget tickers failed');
if (okxBody.code !== '0' || !Array.isArray(okxBody.data)) throw new Error('OKX tickers failed');

const excluded = new Set(['stock', 'metal', 'commodity', 'forex', 'index', 'etf']);
const cryptoSymbols = new Set(instrumentBody.data.filter(x => !excluded.has(String(x.symbolType ?? '').toLowerCase())).map(x => String(x.symbol ?? '')));
const bg = new Map(bitgetBody.data.map(x => [String(x.symbol ?? ''), x]));
const okx = new Map();
for (const x of okxBody.data) {
  const m = String(x.instId ?? '').match(/^([A-Z0-9]+)-USDT-SWAP$/);
  if (m) okx.set(`${m[1]}USDT`, x);
}

const rows = [];
for (const symbol of cryptoSymbols) {
  if (!/^[A-Z0-9]+USDT$/.test(symbol)) continue;
  const b = bg.get(symbol), o = okx.get(symbol);
  if (!b || !o) continue;
  const last = num(b.lastPr), open = num(b.open24h), low24 = num(b.low24h), high24 = num(b.high24h);
  const okLast = num(o.last), okOpen = num(o.open24h);
  if (!(last > 0)) continue;
  const change = open > 0 ? (last / open - 1) * 100 : num(b.change24h) * 100;
  const okChange = okLast != null && okOpen > 0 ? (okLast / okOpen - 1) * 100 : null;
  const turnover = num(b.usdtVolume) ?? num(b.quoteVolume) ?? 0;
  const funding = num(b.fundingRate) ?? 0;
  const spread = spreadBps(num(b.bidPr), num(b.askPr));
  const dist24LowPct = low24 > 0 ? (last / low24 - 1) * 100 : null;
  const dist24HighPct = high24 > 0 ? (high24 / last - 1) * 100 : null;
  const agreement = change == null || okChange == null ? 0 : Math.sign(change) === Math.sign(okChange) ? 1 : 0;
  const liquidity = turnover > 0 ? clamp(24 * Math.log10(turnover / 1e6 + 1)) : 0;
  const drop = clamp((-(change ?? 0) - 1) / 11 * 100);
  const proximity = dist24LowPct == null ? 0 : clamp((4 - dist24LowPct) / 4 * 100);
  const fundingCrowd = clamp((-funding - .00005) / .0007 * 100);
  const spreadScore = spread == null ? 35 : clamp(100 - spread * 4);
  const preliminary = drop * .34 + proximity * .22 + fundingCrowd * .18 + liquidity * .14 + spreadScore * .08 + agreement * 4;
  rows.push({ symbol, base: symbol.slice(0, -4), last, low24, high24, change24hPct: change, okxChange24hPct: okChange, turnover24hUsd: turnover, funding, spreadBps: spread, dist24LowPct, dist24HighPct, agreement, liquidity, preliminary });
}

const majors = new Set(['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','SUIUSDT','LINKUSDT','AVAXUSDT','TONUSDT','NEARUSDT','LTCUSDT','BCHUSDT','ATOMUSDT','DOTUSDT','TRXUSDT','FILUSDT']);
const liquid = rows.filter(r => r.turnover24hUsd >= 500_000 && (r.spreadBps == null || r.spreadBps <= 20));
const ranked = liquid.slice().sort((a, b) => b.preliminary - a.preliminary);
const mostDown = liquid.slice().sort((a, b) => (a.change24hPct ?? 0) - (b.change24hPct ?? 0)).slice(0, 35);
const crowdedShorts = liquid.slice().sort((a, b) => a.funding - b.funding).slice(0, 25);
const forcedMajors = rows.filter(r => majors.has(r.symbol));
const poolMap = new Map();
for (const r of [...ranked.slice(0, 55), ...mostDown, ...crowdedShorts, ...forcedMajors]) poolMap.set(r.symbol, r);
const pool = [...poolMap.values()].slice(0, 105);

async function detail(row) {
  const instId = `${row.base}-USDT-SWAP`;
  const [b, o] = await Promise.allSettled([
    get(`https://api.bitget.com/api/v2/mix/market/candles?symbol=${encodeURIComponent(row.symbol)}&productType=USDT-FUTURES&granularity=5m&limit=180`),
    get(`https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=5m&limit=180`),
  ]);
  const bs = b.status === 'fulfilled' ? candleStats(normalizeBitget(b.value)) : null;
  const os = o.status === 'fulfilled' ? candleStats(normalizeOkx(o.value)) : null;
  const stats = [bs, os].filter(Boolean);
  if (!stats.length) return null;
  return {
    ret15Pct: median(stats.map(x => x.ret15Pct)), ret60Pct: median(stats.map(x => x.ret60Pct)), ret240Pct: median(stats.map(x => x.ret240Pct)),
    volAccel: median(stats.map(x => x.volAccel)), compression: median(stats.map(x => x.compression)),
    priorHigh: median(stats.map(x => x.priorHigh)), priorLow: median(stats.map(x => x.priorLow)),
    localLow: median(stats.map(x => x.localLow)), localHigh: median(stats.map(x => x.localHigh)),
    rangePosition: median(stats.map(x => x.rangePosition)),
    rsi5m: median(stats.map(x => x.rsi5m)), rsi15m: median(stats.map(x => x.rsi15m)), rsi1h: median(stats.map(x => x.rsi1h)),
    sources: stats.length,
  };
}

function score(row, d) {
  const drop = clamp((-(row.change24hPct ?? 0) - 1) / 11 * 100);
  const rsiScore = mean([
    d.rsi5m == null ? null : clamp((48 - d.rsi5m) / 25 * 100),
    d.rsi15m == null ? null : clamp((48 - d.rsi15m) / 25 * 100),
    d.rsi1h == null ? null : clamp((50 - d.rsi1h) / 25 * 100),
  ]) ?? 0;
  const support = row.dist24LowPct == null ? 25 : clamp((4 - row.dist24LowPct) / 4 * 100);
  const volumeDry = d.volAccel == null ? 25 : clamp((1.15 - d.volAccel) / .9 * 100);
  const compression = d.compression == null ? 25 : clamp((1.05 - d.compression) / .65 * 100);
  const fundingCrowd = clamp((-row.funding - .00005) / .0007 * 100);
  const stabilising = clamp(((d.ret15Pct ?? -1.2) + 1.2) / 1.8 * 100) * .55 + clamp(((d.ret60Pct ?? -2) + 2) / 3 * 100) * .45;
  const execution = clamp((row.liquidity * .45) + ((row.spreadBps == null ? 35 : clamp(100 - row.spreadBps * 4)) * .55));
  let raw = drop * .18 + rsiScore * .19 + support * .16 + volumeDry * .14 + compression * .09 + fundingCrowd * .12 + stabilising * .12;
  const reboundScore = clamp(raw * (.55 + execution / 100 * .45));

  const stillFalling = (d.ret15Pct ?? 0) < -.7 || (d.ret60Pct ?? 0) < -2;
  const dryAtSupport = (row.dist24LowPct ?? 99) <= 3 && (d.volAccel ?? 99) <= .9 && !stillFalling;
  const squeeze = row.funding <= -.0003 && !stillFalling;
  const bounceStarting = (d.ret15Pct ?? 0) > .15 && (d.ret60Pct ?? 0) >= -.4;
  const stage = stillFalling ? 'CATCH-KNIFE-RISK' : bounceStarting ? 'BOUNCE-STARTING' : squeeze ? 'SQUEEZE-WATCH' : dryAtSupport ? 'DRY-SUPPORT' : 'WATCH';

  const trigger = Math.max(row.last, d.localHigh ?? row.last);
  const invalidation = Math.min(row.low24 ?? row.last, d.localLow ?? row.last);
  const potentialToLocalHighPct = d.priorHigh > row.last ? (d.priorHigh / row.last - 1) * 100 : null;

  return {
    symbol: row.symbol,
    price: round(row.last, 10),
    stage,
    reboundScore: round(reboundScore, 1),
    metrics: {
      change24hPct: round(row.change24hPct, 2), okxChange24hPct: round(row.okxChange24hPct, 2),
      ret15Pct: round(d.ret15Pct, 2), ret60Pct: round(d.ret60Pct, 2), ret240Pct: round(d.ret240Pct, 2),
      rsi5m: round(d.rsi5m, 1), rsi15m: round(d.rsi15m, 1), rsi1h: round(d.rsi1h, 1),
      volumeAcceleration: round(d.volAccel, 2), compressionRatio: round(d.compression, 2),
      fundingPct: round(row.funding * 100, 4), turnover24hUsd: round(row.turnover24hUsd, 0), bitgetSpreadBps: round(row.spreadBps, 2),
      distanceFrom24hLowPct: round(row.dist24LowPct, 2), rangePosition: round(d.rangePosition, 2), candleSources: d.sources,
      potentialToPriorHighPct: round(potentialToLocalHighPct, 2),
    },
    levels: { trigger: round(trigger, 10), invalidationReference: round(invalidation, 10), priorRangeHigh: round(d.priorHigh, 10), priorRangeLow: round(d.priorLow, 10) },
    reasons: [
      (row.change24hPct ?? 0) <= -5 ? `24h ${round(row.change24hPct, 1)}%` : null,
      d.rsi15m != null && d.rsi15m <= 35 ? `RSI15 ${round(d.rsi15m, 0)}` : null,
      d.rsi1h != null && d.rsi1h <= 38 ? `RSI1h ${round(d.rsi1h, 0)}` : null,
      (row.dist24LowPct ?? 99) <= 2 ? `у 24h low +${round(row.dist24LowPct, 2)}%` : null,
      (d.volAccel ?? 99) <= .8 ? `volume dry x${round(d.volAccel, 2)}` : null,
      row.funding <= -.0003 ? `funding ${round(row.funding * 100, 3)}%` : null,
      (d.ret15Pct ?? 0) > .15 ? `15m +${round(d.ret15Pct, 2)}%` : null,
      row.spreadBps != null && row.spreadBps <= 5 ? `spread ${round(row.spreadBps, 2)} bps` : null,
    ].filter(Boolean).slice(0, 6),
  };
}

const detailed = await mapLimit(pool, 6, async row => ({ row, d: await detail(row) }));
const scored = detailed.filter(x => x.d).map(x => score(x.row, x.d)).sort((a, b) => b.reboundScore - a.reboundScore);
const tradeable = scored.filter(x => (x.metrics.turnover24hUsd ?? 0) >= 1_000_000 && (x.metrics.bitgetSpreadBps ?? 999) <= 8 && x.stage !== 'CATCH-KNIFE-RISK');
const doge = scored.find(x => x.symbol === 'DOGEUSDT') ?? null;

const report = {
  asOf: new Date().toISOString(),
  methodologyVersion: 'crypto-rebound-v1-okx-bitget',
  purpose: 'Long rebound watch: oversold/support/volume dry-up/funding crowding with execution filter on Bitget',
  sources: ['Bitget USDT futures instruments/tickers/candles', 'OKX USDT swap tickers/candles'],
  limitations: ['Binance and Bybit are not in this snapshot because their public APIs are geo-blocked from the current runner.', 'Rebound score is a watchlist rank, not a buy instruction. A trigger and invalidation are required.', 'RSI is calculated from public 5m candles, with 15m/1h bars aggregated from the same series.'],
  status: { bitgetCryptoUsdtFutures: cryptoSymbols.size, commonWithOkx: rows.length, candidatePool: pool.length, scored: scored.length, tradeable: tradeable.length },
  doge,
  topTradeable: tradeable.slice(0, 12),
  topAll: scored.slice(0, 20),
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
