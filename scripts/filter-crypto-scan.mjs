import { readFile, writeFile } from 'node:fs/promises';

const path = 'data/crypto-scan-latest.json';
const report = JSON.parse(await readFile(path, 'utf8'));

const response = await fetch('https://api.bitget.com/api/v3/market/instruments?category=USDT-FUTURES', {
  headers: { accept: 'application/json', 'user-agent': 'ScreenerPRO/crypto-filter' },
  signal: AbortSignal.timeout(15000),
});
if (!response.ok) throw new Error(`Bitget instruments HTTP ${response.status}`);
const body = await response.json();
if (body.code !== '00000' || !Array.isArray(body.data)) throw new Error(`Bitget instruments ${body.code ?? 'unknown'} ${body.msg ?? ''}`);

const meta = new Map(body.data.map((row) => [String(row.symbol ?? ''), row]));
const excludedTypes = new Set(['stock', 'metal', 'commodity', 'forex', 'index', 'etf']);
const isCrypto = (item) => {
  const row = meta.get(item.symbol);
  if (!row) return false;
  const type = String(row.symbolType ?? '').toLowerCase();
  return !excludedTypes.has(type);
};

const keys = ['topOverall','topIgnition','topPreBreakout','topSqueeze','topMomentum','topLiquidity'];
for (const key of keys) {
  if (Array.isArray(report[key])) report[key] = report[key].filter(isCrypto);
}

const counts = {};
for (const row of body.data) {
  const type = String(row.symbolType ?? 'unknown').toLowerCase() || 'unknown';
  counts[type] = (counts[type] ?? 0) + 1;
}
report.cryptoFilter = {
  source: 'Bitget v3 instruments symbolType',
  excludedTypes: [...excludedTypes],
  symbolTypeCounts: counts,
};

await writeFile(path, JSON.stringify(report, null, 2) + '\n');
