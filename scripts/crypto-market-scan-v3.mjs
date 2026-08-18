const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const round = (v, d = 2) => v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d));
const mean = (xs) => { const a = xs.filter(Number.isFinite); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const median = (xs) => { const a = xs.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

async function get(url) {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'ScreenerPRO/crypto-v3' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}
function spreadBps(bid, ask) { if (!(bid > 0) || !(ask >= bid)) return null; const mid = (bid + ask) / 2; return (ask - bid) / mid * 10000; }

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
  const last = num(b.lastPr), open = num(b.open24h);
  const okLast = num(o.last), okOpen = num(o.open24h);
  const change = last != null && open > 0 ? (last / open - 1) * 100 : num(b.change24h) * 100;
  const okChange = okLast != null && okOpen > 0 ? (okLast / okOpen - 1) * 100 : null;
  const turnover = num(b.usdtVolume) ?? num(b.quoteVolume) ?? 0;
  const funding = num(b.fundingRate) ?? 0;
  const spread = spreadBps(num(b.bidPr), num(b.askPr));
  const agreement = change == null || okChange == null ? 0 : Math.sign(change) === Math.sign(okChange) ? 1 : 0;
  const liquidity = turnover > 0 ? clamp(24 * Math.log10(turnover / 1e6 + 1)) : 0;
  const move = clamp(Math.abs(change ?? 0) / 12 * 100);
  const fundingExtreme = clamp(Math.abs(funding) / .001 * 100);
  const spreadScore = spread == null ? 40 : clamp(100 - spread * 4);
  const preliminary = move * .30 + liquidity * .30 + fundingExtreme * .15 + agreement * 10 + spreadScore * .15;
  rows.push({ symbol, base: symbol.slice(0, -4), last, change24hPct: change, okxChange24hPct: okChange, turnover24hUsd: turnover, funding, spreadBps: spread, agreement, liquidity, preliminary });
}
rows.sort((a, b) => b.preliminary - a.preliminary);

function normalizeBitget(raw) {
  return (raw?.data ?? raw ?? []).map(x => ({ t: num(x[0]), o: num(x[1]), h: num(x[2]), l: num(x[3]), c: num(x[4]), v: num(x[6]) ?? num(x[5]) })).filter(x => x.t && x.c > 0).sort((a, b) => a.t - b.t);
}
function normalizeOkx(raw) {
  return (raw?.data ?? []).map(x => ({ t: num(x[0]), o: num(x[1]), h: num(x[2]), l: num(x[3]), c: num(x[4]), v: num(x[7]) ?? num(x[5]) })).filter(x => x.t && x.c > 0).sort((a, b) => a.t - b.t);
}
function candleStats(a) {
  if (a.length < 30) return null;
  const last = a.at(-1), at = n => a.at(-1 - n)?.c;
  const ret = n => at(n) ? (last.c / at(n) - 1) * 100 : null;
  const recentVol = mean(a.slice(-3).map(x => x.v).filter(v => v > 0));
  const priorVol = mean(a.slice(-15, -3).map(x => x.v).filter(v => v > 0));
  const volAccel = recentVol != null && priorVol > 0 ? recentVol / priorVol : null;
  const prior = a.slice(-27, -3);
  const priorHigh = Math.max(...prior.map(x => x.h));
  const priorLow = Math.min(...prior.map(x => x.l));
  const recentRange = mean(a.slice(-6).map(x => (x.h - x.l) / x.c * 100));
  const oldRange = mean(a.slice(-24, -6).map(x => (x.h - x.l) / x.c * 100));
  return {
    ret15Pct: ret(3), ret60Pct: ret(12), volAccel,
    compression: recentRange != null && oldRange > 0 ? recentRange / oldRange : null,
    priorHigh, priorLow,
    distHighPct: priorHigh > 0 ? (priorHigh - last.c) / last.c * 100 : null,
    distLowPct: priorLow > 0 ? (last.c - priorLow) / last.c * 100 : null,
    rangePosition: priorHigh > priorLow ? (last.c - priorLow) / (priorHigh - priorLow) : .5,
    breakout: last.c > priorHigh ? 1 : last.c < priorLow ? -1 : 0,
    last: last.c,
  };
}
async function detail(row) {
  const instId = `${row.base}-USDT-SWAP`;
  const [b, o] = await Promise.allSettled([
    get(`https://api.bitget.com/api/v2/mix/market/candles?symbol=${encodeURIComponent(row.symbol)}&productType=USDT-FUTURES&granularity=5m&limit=60`),
    get(`https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=5m&limit=60`),
  ]);
  const bs = b.status === 'fulfilled' ? candleStats(normalizeBitget(b.value)) : null;
  const os = o.status === 'fulfilled' ? candleStats(normalizeOkx(o.value)) : null;
  const stats = [bs, os].filter(Boolean);
  if (!stats.length) return null;
  const breakoutVotes = stats.map(x => x.breakout).filter(Number.isFinite);
  return {
    ret15Pct: median(stats.map(x => x.ret15Pct)), ret60Pct: median(stats.map(x => x.ret60Pct)),
    volAccel: median(stats.map(x => x.volAccel)), compression: median(stats.map(x => x.compression)),
    priorHigh: median(stats.map(x => x.priorHigh)), priorLow: median(stats.map(x => x.priorLow)),
    distHighPct: median(stats.map(x => x.distHighPct)), distLowPct: median(stats.map(x => x.distLowPct)),
    rangePosition: median(stats.map(x => x.rangePosition)), breakout: Math.sign(mean(breakoutVotes) ?? 0),
    sources: stats.length,
  };
}
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let cursor = 0;
  async function worker() { while (cursor < items.length) { const i = cursor++; out[i] = await fn(items[i]); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)); return out;
}

function score(row, d) {
  const vol = d.volAccel == null ? 15 : clamp((d.volAccel - 1) / 3 * 100);
  const r15 = d.ret15Pct == null ? 0 : clamp(Math.abs(d.ret15Pct) / 3 * 100);
  const r60 = d.ret60Pct == null ? 0 : clamp(Math.abs(d.ret60Pct) / 8 * 100);
  const comp = d.compression == null ? 20 : clamp((1 - d.compression) / .5 * 100);
  const near = Math.min(Math.abs(d.distHighPct ?? 99), Math.abs(d.distLowPct ?? 99));
  const prox = d.breakout ? 100 : clamp((2 - near) / 2 * 100);
  const fundingExtreme = clamp(Math.abs(row.funding) / .001 * 100);
  const spreadScore = row.spreadBps == null ? 40 : clamp(100 - row.spreadBps * 4);
  const ignition = clamp(vol * .34 + r15 * .24 + prox * .22 + row.liquidity * .12 + row.agreement * 8);
  const prebreakout = clamp(comp * .35 + prox * .35 + Math.min(vol, 70) * .12 + row.liquidity * .10 + row.agreement * 8);
  const momentum = clamp(r60 * .38 + r15 * .20 + vol * .20 + row.liquidity * .14 + row.agreement * 8);
  let squeezeDir = null, resilience = 15;
  if (row.funding <= -.0003) { squeezeDir = 'LONG'; resilience = clamp(((d.ret15Pct ?? 0) + .8) / 1.6 * 100); }
  else if (row.funding >= .0003) { squeezeDir = 'SHORT'; resilience = clamp((.8 - (d.ret15Pct ?? 0)) / 1.6 * 100); }
  const squeeze = clamp(fundingExtreme * .48 + resilience * .20 + row.liquidity * .20 + comp * .12);
  const trendRaw = median([d.ret15Pct, d.ret60Pct, row.change24hPct]);
  const trendDir = (trendRaw ?? 0) >= 0 ? 'LONG' : 'SHORT';
  let preDir = trendDir; if ((d.rangePosition ?? .5) > .68) preDir = 'LONG'; if ((d.rangePosition ?? .5) < .32) preDir = 'SHORT';
  const cats = [
    { type: 'IGNITION', score: ignition, direction: trendDir },
    { type: 'PRE-BREAKOUT', score: prebreakout, direction: preDir },
    { type: 'MOMENTUM', score: momentum, direction: trendDir },
    { type: 'SQUEEZE-WATCH', score: squeeze, direction: squeezeDir ?? trendDir },
  ].sort((a, b) => b.score - a.score);
  const primary = cats[0];
  const execution = .55 + spreadScore / 100 * .30 + row.liquidity / 100 * .15;
  const overall = clamp(primary.score * execution);
  const trigger = primary.direction === 'LONG' ? d.priorHigh : d.priorLow;
  const invalidation = primary.direction === 'LONG' ? d.priorLow : d.priorHigh;
  return {
    symbol: row.symbol, price: round(row.last, 10), type: primary.type, direction: primary.direction, overall: round(overall, 1),
    scores: { ignition: round(ignition, 1), prebreakout: round(prebreakout, 1), momentum: round(momentum, 1), squeeze: round(squeeze, 1), liquidity: round(row.liquidity, 1), execution: round(spreadScore, 1) },
    metrics: { change24hPct: round(row.change24hPct, 2), okxChange24hPct: round(row.okxChange24hPct, 2), ret15Pct: round(d.ret15Pct, 2), ret60Pct: round(d.ret60Pct, 2), volumeAcceleration: round(d.volAccel, 2), fundingPct: round(row.funding * 100, 4), turnover24hUsd: round(row.turnover24hUsd, 0), bitgetSpreadBps: round(row.spreadBps, 2), compressionRatio: round(d.compression, 2), rangePosition: round(d.rangePosition, 2), candleSources: d.sources },
    levels: { trigger: round(trigger, 10), invalidationReference: round(invalidation, 10) },
    reasons: [
      d.volAccel >= 1.8 ? `volume x${round(d.volAccel, 1)}` : null,
      Math.abs(row.funding * 100) >= .03 ? `funding ${round(row.funding * 100, 3)}%` : null,
      d.breakout ? (d.breakout > 0 ? '5m breakout up' : '5m breakout down') : near <= 1 ? `до границы ~${round(near, 2)}%` : null,
      d.compression <= .7 ? 'compression' : null,
      row.agreement ? 'OKX/Bitget 24h direction agree' : null,
      row.spreadBps <= 5 ? 'tight Bitget spread' : null,
    ].filter(Boolean).slice(0, 5),
  };
}

const pool = rows.slice(0, 60);
const detailed = await mapLimit(pool, 5, async row => ({ row, d: await detail(row) }));
const scored = detailed.filter(x => x.d).map(x => score(x.row, x.d)).filter(x => x.metrics.bitgetSpreadBps == null || x.metrics.bitgetSpreadBps <= 50).sort((a, b) => b.overall - a.overall);
const top = (key, n = 8) => scored.slice().sort((a, b) => (b.scores[key] ?? 0) - (a.scores[key] ?? 0)).slice(0, n);
const report = {
  asOf: new Date().toISOString(), methodologyVersion: 'crypto-scan-v3-okx-bitget',
  sources: ['Bitget USDT futures instruments/tickers/candles', 'OKX USDT swap tickers/candles'],
  limitations: ['Binance and Bybit public APIs are currently geo-blocked from the GitHub runner, so they are not included in this snapshot.', 'OI change is not scored in v3 until a reliable history source or stored snapshots are available.', 'Squeeze is therefore a watch condition based on funding + price resilience/compression, not a confirmed OI squeeze.'],
  status: { bitgetCryptoUsdtFutures: cryptoSymbols.size, commonWithOkx: rows.length, detailedPool: pool.length },
  topOverall: scored.slice(0, 12), topIgnition: top('ignition'), topPreBreakout: top('prebreakout'), topSqueeze: top('squeeze'), topMomentum: top('momentum'), topLiquidity: top('liquidity'), topExecution: top('execution'),
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
