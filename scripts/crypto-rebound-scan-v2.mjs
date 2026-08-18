const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const round = (v, d = 2) => v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d));
const mean = (xs) => { const a = xs.filter(Number.isFinite); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const median = (xs) => { const a = xs.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

async function get(url) {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'ScreenerPRO/rebound-v2' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}
function spreadBps(bid, ask) { if (!(bid > 0) || !(ask >= bid)) return null; const mid = (bid + ask) / 2; return (ask - bid) / mid * 10000; }
function rsi(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  const tail = closes.slice(-(period + 1));
  for (let i = 1; i < tail.length; i++) { const d = tail[i] - tail[i - 1]; if (d > 0) gains += d; else losses -= d; }
  const avgGain = gains / period, avgLoss = losses / period;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}
function ema(values, period) {
  if (!values.length) return null;
  const k = 2 / (period + 1); let e = values[0];
  for (let i = 1; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}
function aggregateBars(rows, size) {
  const out = [];
  for (let i = rows.length % size; i + size <= rows.length; i += size) {
    const g = rows.slice(i, i + size);
    out.push({ t: g[0].t, o: g[0].o, h: Math.max(...g.map(x => x.h)), l: Math.min(...g.map(x => x.l)), c: g.at(-1).c, v: g.reduce((s, x) => s + (x.v ?? 0), 0) });
  }
  return out;
}
function normalizeBitget(raw) {
  return (raw?.data ?? raw ?? []).map(x => ({ t: num(x[0]), o: num(x[1]), h: num(x[2]), l: num(x[3]), c: num(x[4]), v: num(x[6]) ?? num(x[5]) })).filter(x => x.t && x.c > 0).sort((a, b) => a.t - b.t);
}
function normalizeOkx(raw) {
  return (raw?.data ?? []).map(x => ({ t: num(x[0]), o: num(x[1]), h: num(x[2]), l: num(x[3]), c: num(x[4]), v: num(x[7]) ?? num(x[5]) })).filter(x => x.t && x.c > 0).sort((a, b) => a.t - b.t);
}
function wickScore(bars) {
  const xs = bars.slice(-3).map(x => { const range = x.h - x.l; if (!(range > 0)) return 0; return (Math.min(x.o, x.c) - x.l) / range; });
  return clamp((mean(xs) ?? 0) * 140);
}
function fastStats(a) {
  if (a.length < 150) return null;
  const last = a.at(-1); const at = n => a.at(-1 - n)?.c; const ret = n => at(n) ? (last.c / at(n) - 1) * 100 : null;
  const recentVol = mean(a.slice(-3).map(x => x.v).filter(v => v > 0));
  const priorVol = mean(a.slice(-48, -3).map(x => x.v).filter(v => v > 0));
  const volAccel = recentVol != null && priorVol > 0 ? recentVol / priorVol : null;
  const baselineVol = median(a.slice(-150, -24).map(x => x.v).filter(v => v > 0));
  const climaxVol = Math.max(...a.slice(-24).map(x => x.v ?? 0));
  const climaxRatio = baselineVol > 0 ? climaxVol / baselineVol : null;
  const last144 = a.slice(-144); const localLow = Math.min(...last144.map(x => x.l)); const lowIdx = last144.findLastIndex(x => x.l === localLow); const barsSinceLow = lowIdx >= 0 ? last144.length - 1 - lowIdx : null;
  const localHigh = Math.max(...a.slice(-36).map(x => x.h));
  const m15 = aggregateBars(a, 3); const h1 = aggregateBars(a, 12);
  return { ret15Pct: ret(3), ret60Pct: ret(12), ret240Pct: ret(48), ret720Pct: ret(144), volAccel, climaxRatio, barsSinceLow, localLow, localHigh, rsi5m: rsi(a.map(x => x.c)), rsi15m: rsi(m15.map(x => x.c)), rsi1h: rsi(h1.map(x => x.c)), wickScore: wickScore(a), last: last.c };
}
function globalStats(a) {
  if (a.length < 100) return null;
  const last = a.at(-1); const at = n => a.at(-1 - n)?.c; const ret = n => at(n) ? (last.c / at(n) - 1) * 100 : null;
  const low7d = Math.min(...a.slice(-42).map(x => x.l)); const low30d = Math.min(...a.map(x => x.l)); const high30d = Math.max(...a.map(x => x.h));
  const recentLow = Math.min(...a.slice(-6).map(x => x.l)); const previousLow = Math.min(...a.slice(-24, -6).map(x => x.l));
  const higherLowPct = previousLow > 0 ? (recentLow / previousLow - 1) * 100 : null;
  const recentRange = mean(a.slice(-6).map(x => (x.h - x.l) / x.c * 100)); const priorRange = mean(a.slice(-30, -6).map(x => (x.h - x.l) / x.c * 100));
  const compression = recentRange != null && priorRange > 0 ? recentRange / priorRange : null;
  const closes = a.map(x => x.c); const e20 = ema(closes.slice(-60), 20); const e20Prev = ema(closes.slice(-66, -6), 20); const ema20Slope6BarsPct = e20 && e20Prev ? (e20 / e20Prev - 1) * 100 : null;
  const belowEma20Pct = e20 > 0 ? (last.c / e20 - 1) * 100 : null;
  const d1 = aggregateBars(a, 6);
  return { ret1dPct: ret(6), ret3dPct: ret(18), ret7dPct: ret(42), ret30dPct: ret(Math.min(179, a.length - 1)), rsi4h: rsi(closes), rsi1d: rsi(d1.map(x => x.c)), low7d, low30d, high30d, distance7dLowPct: low7d > 0 ? (last.c / low7d - 1) * 100 : null, distance30dLowPct: low30d > 0 ? (last.c / low30d - 1) * 100 : null, higherLowPct, compression, ema20Slope6BarsPct, belowEma20Pct, last: last.c };
}
async function mapLimit(items, limit, fn) { const out = new Array(items.length); let cursor = 0; async function worker() { while (cursor < items.length) { const i = cursor++; out[i] = await fn(items[i]); } } await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)); return out; }

const [instrumentBody, bitgetBody, okxBody] = await Promise.all([
  get('https://api.bitget.com/api/v3/market/instruments?category=USDT-FUTURES'),
  get('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES'),
  get('https://www.okx.com/api/v5/market/tickers?instType=SWAP'),
]);
if (instrumentBody.code !== '00000' || !Array.isArray(instrumentBody.data)) throw new Error('Bitget instruments failed');
if (bitgetBody.code !== '00000' || !Array.isArray(bitgetBody.data)) throw new Error('Bitget tickers failed');
if (okxBody.code !== '0' || !Array.isArray(okxBody.data)) throw new Error('OKX tickers failed');
const excluded = new Set(['stock','metal','commodity','forex','index','etf']);
const cryptoSymbols = new Set(instrumentBody.data.filter(x => !excluded.has(String(x.symbolType ?? '').toLowerCase())).map(x => String(x.symbol ?? '')));
const bg = new Map(bitgetBody.data.map(x => [String(x.symbol ?? ''), x]));
const okx = new Map(); for (const x of okxBody.data) { const m = String(x.instId ?? '').match(/^([A-Z0-9]+)-USDT-SWAP$/); if (m) okx.set(`${m[1]}USDT`, x); }
const rows = [];
for (const symbol of cryptoSymbols) {
  if (!/^[A-Z0-9]+USDT$/.test(symbol)) continue; const b = bg.get(symbol), o = okx.get(symbol); if (!b || !o) continue;
  const last = num(b.lastPr), open = num(b.open24h), low24 = num(b.low24h), high24 = num(b.high24h), okLast = num(o.last), okOpen = num(o.open24h); if (!(last > 0)) continue;
  const change = open > 0 ? (last / open - 1) * 100 : num(b.change24h) * 100; const okChange = okLast != null && okOpen > 0 ? (okLast / okOpen - 1) * 100 : null;
  const turnover = num(b.usdtVolume) ?? num(b.quoteVolume) ?? 0; const funding = num(b.fundingRate) ?? 0; const spread = spreadBps(num(b.bidPr), num(b.askPr));
  rows.push({ symbol, base: symbol.slice(0,-4), last, low24, high24, change24hPct: change, okxChange24hPct: okChange, turnover24hUsd: turnover, funding, spreadBps: spread, dist24LowPct: low24 > 0 ? (last / low24 - 1) * 100 : null, liquidity: turnover > 0 ? clamp(24 * Math.log10(turnover / 1e6 + 1)) : 0 });
}

async function detail(row) {
  const instId = `${row.base}-USDT-SWAP`;
  const [b5, o5, b4h] = await Promise.allSettled([
    get(`https://api.bitget.com/api/v2/mix/market/candles?symbol=${encodeURIComponent(row.symbol)}&productType=USDT-FUTURES&granularity=5m&limit=180`),
    get(`https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=5m&limit=180`),
    get(`https://api.bitget.com/api/v2/mix/market/candles?symbol=${encodeURIComponent(row.symbol)}&productType=USDT-FUTURES&granularity=4H&limit=180`),
  ]);
  const fast = [];
  if (b5.status === 'fulfilled') { const s = fastStats(normalizeBitget(b5.value)); if (s) fast.push(s); }
  if (o5.status === 'fulfilled') { const s = fastStats(normalizeOkx(o5.value)); if (s) fast.push(s); }
  const g = b4h.status === 'fulfilled' ? globalStats(normalizeBitget(b4h.value)) : null;
  if (!fast.length || !g) return null;
  const f = {}; for (const k of Object.keys(fast[0])) f[k] = k === 'last' ? median(fast.map(x => x[k])) : median(fast.map(x => x[k]));
  f.sources = fast.length; return { f, g };
}
function score(row, d) {
  const f = d.f, g = d.g;
  const execution = clamp(row.liquidity * .45 + (row.spreadBps == null ? 35 : clamp(100 - row.spreadBps * 4)) * .55);
  const fastDrop = clamp(Math.max(-(f.ret60Pct ?? 0) / 2.2, -(f.ret240Pct ?? 0) / 5.5, -(f.ret720Pct ?? 0) / 9, -(row.change24hPct ?? 0) / 13) * 100);
  const freshLow = f.barsSinceLow == null ? 20 : clamp((24 - f.barsSinceLow) / 24 * 100);
  const supportFast = row.dist24LowPct == null ? 20 : clamp((3 - row.dist24LowPct) / 3 * 100);
  const oversoldFast = mean([f.rsi15m == null ? null : clamp((42 - f.rsi15m) / 22 * 100), f.rsi1h == null ? null : clamp((45 - f.rsi1h) / 22 * 100)]) ?? 0;
  const climax = f.climaxRatio == null ? 10 : clamp((f.climaxRatio - 1.5) / 4 * 100);
  const dryAfter = f.volAccel == null ? 20 : clamp((1.05 - f.volAccel) / .8 * 100);
  const stabilise = clamp(((f.ret15Pct ?? -1) + 1) / 1.5 * 100);
  const fundingCrowd = clamp((-row.funding - .00005) / .0007 * 100);
  let fastRaw = fastDrop*.24 + freshLow*.12 + supportFast*.12 + oversoldFast*.12 + climax*.10 + dryAfter*.10 + f.wickScore*.06 + stabilise*.06 + fundingCrowd*.08;
  let fastScore = clamp(fastRaw * (.55 + execution/100*.45));

  const support30 = g.distance30dLowPct == null ? 15 : clamp((7 - g.distance30dLowPct) / 7 * 100);
  const oversoldGlobal = mean([g.rsi4h == null ? null : clamp((45 - g.rsi4h) / 22 * 100), g.rsi1d == null ? null : clamp((48 - g.rsi1d) / 24 * 100)]) ?? 0;
  const baseCompression = g.compression == null ? 20 : clamp((1 - g.compression) / .55 * 100);
  const higherLow = g.higherLowPct == null ? 20 : clamp((g.higherLowPct + .5) / 2 * 100);
  const flattening = g.ema20Slope6BarsPct == null ? 20 : clamp((g.ema20Slope6BarsPct + 2.2) / 2.8 * 100);
  const reclaim = g.belowEma20Pct == null ? 20 : clamp((g.belowEma20Pct + 5) / 7 * 100);
  const globalFunding = fundingCrowd;
  const grindingPenalty = clamp((-(g.ret7dPct ?? 0) - 3) / 12 * 55 + (-(g.ema20Slope6BarsPct ?? 0) - .5) / 3 * 30 + ((g.higherLowPct ?? 0) < 0 ? 15 : 0));
  let globalRaw = support30*.20 + oversoldGlobal*.14 + baseCompression*.16 + higherLow*.17 + flattening*.13 + reclaim*.08 + globalFunding*.05 + execution*.07;
  let globalScore = clamp(globalRaw - grindingPenalty*.55);

  const fastCondition = fastDrop >= 38 && freshLow >= 35 && supportFast >= 45;
  const grinding = grindingPenalty >= 55 && !fastCondition && (g.higherLowPct ?? 0) <= 0;
  const baseCondition = globalScore >= 36 && support30 >= 35 && !grinding;
  let setupType = 'WATCH'; let primaryScore = Math.max(fastScore, globalScore);
  if (grinding) setupType = 'GRINDING-DOWNTREND';
  else if (fastCondition && fastScore >= globalScore) setupType = 'FAST-FLUSH';
  else if (baseCondition) setupType = 'GLOBAL-BASE';
  else if (fastScore >= 34) setupType = 'FAST-WATCH';
  const trigger = Math.max(row.last, f.localHigh ?? row.last); const invalidation = Math.min(row.low24 ?? row.last, f.localLow ?? row.last);
  return { symbol: row.symbol, price: round(row.last,10), setupType, primaryScore: round(primaryScore,1), scores: { fastFlush: round(fastScore,1), globalBase: round(globalScore,1), grindingPenalty: round(grindingPenalty,1), execution: round(execution,1) }, metrics: { change24hPct: round(row.change24hPct,2), ret1hPct: round(f.ret60Pct,2), ret4hPct: round(f.ret240Pct,2), ret12hPct: round(f.ret720Pct,2), rsi15m: round(f.rsi15m,1), rsi1h: round(f.rsi1h,1), volumeAcceleration: round(f.volAccel,2), climaxRatio: round(f.climaxRatio,2), barsSinceFastLow: round(f.barsSinceLow,0), lowerWickScore: round(f.wickScore,0), fundingPct: round(row.funding*100,4), turnover24hUsd: round(row.turnover24hUsd,0), bitgetSpreadBps: round(row.spreadBps,2), distance24hLowPct: round(row.dist24LowPct,2), ret1dPct: round(g.ret1dPct,2), ret7dPct: round(g.ret7dPct,2), ret30dPct: round(g.ret30dPct,2), rsi4h: round(g.rsi4h,1), rsi1d: round(g.rsi1d,1), distance30dLowPct: round(g.distance30dLowPct,2), higherLowPct: round(g.higherLowPct,2), globalCompression: round(g.compression,2), ema20SlopePct: round(g.ema20Slope6BarsPct,2), belowEma20Pct: round(g.belowEma20Pct,2), fastCandleSources: f.sources }, levels: { trigger: round(trigger,10), invalidationReference: round(invalidation,10), global30dLow: round(g.low30d,10), global30dHigh: round(g.high30d,10) }, reasons: [ fastCondition ? `быстрый приход: 4h ${round(f.ret240Pct,1)}%, 12h ${round(f.ret720Pct,1)}%` : null, supportFast>=65 ? `у 24h low +${round(row.dist24LowPct,2)}%` : null, f.climaxRatio>=2 ? `volume climax x${round(f.climaxRatio,1)}` : null, f.volAccel<=.75 ? `после слива volume dry x${round(f.volAccel,2)}` : null, g.distance30dLowPct<=3 ? `у 30d low +${round(g.distance30dLowPct,1)}%` : null, (g.higherLowPct??-1)>0 ? `higher low +${round(g.higherLowPct,2)}%` : null, g.compression<=.75 ? '4H compression/base' : null, grinding ? `grinding down: 7d ${round(g.ret7dPct,1)}%, EMA slope ${round(g.ema20Slope6BarsPct,1)}%` : null, row.funding<=-.0003 ? `funding ${round(row.funding*100,3)}%` : null ].filter(Boolean).slice(0,6) };
}

const detailed = await mapLimit(rows, 5, async row => ({ row, d: await detail(row) }));
const scored = detailed.filter(x => x.d).map(x => score(x.row, x.d));
const tradeable = scored.filter(x => (x.metrics.turnover24hUsd ?? 0) >= 750_000 && (x.metrics.bitgetSpreadBps ?? 999) <= 8);
const good = tradeable.filter(x => x.setupType !== 'GRINDING-DOWNTREND');
const fast = good.filter(x => ['FAST-FLUSH','FAST-WATCH'].includes(x.setupType)).sort((a,b) => b.scores.fastFlush-a.scores.fastFlush);
const globalBase = good.filter(x => x.setupType === 'GLOBAL-BASE').sort((a,b) => b.scores.globalBase-a.scores.globalBase);
const grinding = tradeable.filter(x => x.setupType === 'GRINDING-DOWNTREND').sort((a,b) => b.scores.grindingPenalty-a.scores.grindingPenalty);
const bySymbol = Object.fromEntries(scored.filter(x => ['ETCUSDT','WLDUSDT','DOGEUSDT'].includes(x.symbol)).map(x => [x.symbol,x]));
const report = { asOf: new Date().toISOString(), methodologyVersion: 'crypto-rebound-v2-fast-global', purpose: 'Separate fast capitulation rebounds from global bases; penalize persistent grinding downtrends.', sources: ['Bitget USDT futures instruments/tickers/5m+4H candles','OKX USDT swap tickers/5m candles'], limitations: ['Binance and Bybit are still absent while their public APIs are geo-blocked from the collector.','FAST-FLUSH and GLOBAL-BASE are watchlist classifications, not automatic entries.','OI delta is not yet included; it will materially improve squeeze/falling-knife discrimination.'], status: { bitgetCryptoUsdtFutures: cryptoSymbols.size, commonWithOkx: rows.length, deepScanned: scored.length, tradeable: tradeable.length, fastCandidates: fast.length, globalBaseCandidates: globalBase.length, grindingDowntrends: grinding.length }, examples: bySymbol, topFastFlush: fast.slice(0,20), topGlobalBase: globalBase.slice(0,20), avoidGrinding: grinding.slice(0,20) };
process.stdout.write(JSON.stringify(report,null,2)+'\n');
