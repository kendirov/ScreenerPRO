type JsonRecord = Record<string, unknown>;
type Category = "SPOT" | "USDT-FUTURES";
type ProbeResult = { name: string; ok: boolean; latencyMs: number; summary: string; error?: string };

const BASE_URL = "https://api.bitget.com";
const SYMBOL = "BTCUSDT";

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): boolean {
  return value !== "" && Number.isFinite(Number(value));
}

function validTimestamp(value: unknown): boolean {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function rowMatches(row: JsonRecord, category: Category, symbol = SYMBOL): boolean {
  return row.symbol === symbol && (row.category == null || row.category === category);
}

function errorClass(error: unknown): string {
  if (error instanceof Error && /timeout|timed out|abort/i.test(error.message)) return "TIMEOUT";
  if (error instanceof Error && /fetch failed|network|dns|socket|connect/i.test(error.message)) return "NETWORK_ERROR";
  return "NETWORK_ERROR";
}

function summarize(data: unknown): string {
  if (Array.isArray(data)) return `array(${data.length})`;
  if (!isRecord(data)) return typeof data;
  if (Array.isArray(data.list)) return `object(list:${data.list.length})`;
  if (Array.isArray(data.a) && Array.isArray(data.b)) return `orderbook(a:${data.a.length},b:${data.b.length})`;
  return "object";
}

async function request(name: string, path: string, validate: (data: unknown) => string): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 403 || response.status === 451) {
      throw new Error(`ENVIRONMENT_OR_GEO_BLOCKED HTTP ${response.status}`);
    }
    if (!response.ok) throw new Error(`HTTP_ERROR ${response.status}`);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error("HTTP_ERROR invalid JSON");
    }
    if (!isRecord(body) || body.code !== "00000") {
      const code = isRecord(body) && typeof body.code === "string" ? body.code : "unknown";
      const message = isRecord(body) && typeof body.msg === "string" ? body.msg : "invalid envelope";
      throw new Error(`BITGET_API_ERROR ${code}: ${message}`);
    }
    const summary = validate(body.data);
    return { name, ok: true, latencyMs: Date.now() - started, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const classification = /ENVIRONMENT_OR_GEO_BLOCKED|HTTP_ERROR|BITGET_API_ERROR/.test(message)
      ? message.split(" ")[0]
      : errorClass(error);
    return { name, ok: false, latencyMs: Date.now() - started, summary: "—", error: `${classification}: ${message}` };
  }
}

function arrayProbe(category: Category, fields: string[] = [], requireSymbol = true) {
  return (data: unknown) => {
    if (!Array.isArray(data)) throw new Error("shape: expected array");
    const row = data.find((item): item is JsonRecord => {
      if (!isRecord(item)) return false;
      if (item.symbol == null && !requireSymbol) return true;
      return rowMatches(item, category);
    });
    if (!row) throw new Error(`symbol: ${SYMBOL}/${category} not returned`);
    for (const field of fields) if (row[field] != null && !finiteNumber(row[field])) throw new Error(`numeric: ${field}`);
    if (row.ts != null && !validTimestamp(row.ts)) throw new Error("timestamp: ts");
    return summarize(data);
  };
}

const probes: Array<Promise<ProbeResult>> = [
  request("futures instruments", `/api/v3/market/instruments?category=USDT-FUTURES&symbol=${SYMBOL}`, arrayProbe("USDT-FUTURES")),
  request("futures ticker", `/api/v3/market/tickers?category=USDT-FUTURES&symbol=${SYMBOL}`, arrayProbe("USDT-FUTURES", ["lastPrice", "price24hPcnt", "turnover24h", "openInterest"])),
  request("futures orderbook", `/api/v3/market/orderbook?category=USDT-FUTURES&symbol=${SYMBOL}&limit=5`, (data) => {
    if (!isRecord(data) || !Array.isArray(data.a) || !Array.isArray(data.b)) throw new Error("shape: expected a/b arrays");
    if (data.ts != null && !validTimestamp(data.ts)) throw new Error("timestamp: ts");
    for (const side of [data.a, data.b]) for (const level of side) {
      if (!Array.isArray(level) || level.length < 2 || !finiteNumber(level[0]) || !finiteNumber(level[1])) throw new Error("numeric: orderbook level");
    }
    return summarize(data);
  }),
  request("futures public fills", `/api/v3/market/fills?category=USDT-FUTURES&symbol=${SYMBOL}&limit=5`, arrayProbe("USDT-FUTURES", ["price", "size"], false)),
  request("open interest", `/api/v3/market/open-interest?category=USDT-FUTURES&symbol=${SYMBOL}`, (data) => {
    if (!isRecord(data) || !Array.isArray(data.list)) throw new Error("shape: expected list");
    const row = data.list.find((item): item is JsonRecord => isRecord(item) && item.symbol === SYMBOL);
    if (!row || !finiteNumber(row.openInterest)) throw new Error("symbol/numeric: openInterest");
    if (data.ts != null && !validTimestamp(data.ts)) throw new Error("timestamp: ts");
    return summarize(data);
  }),
  request("current funding", `/api/v3/market/current-fund-rate?category=USDT-FUTURES&symbol=${SYMBOL}`, arrayProbe("USDT-FUTURES", ["fundingRate"])),
  request("liquidation history", `/api/v3/market/liquidations?category=USDT-FUTURES&symbol=${SYMBOL}&limit=5`, (data) => {
    if (!isRecord(data) || !Array.isArray(data.list)) throw new Error("shape: expected list");
    for (const item of data.list) {
      if (!isRecord(item) || item.symbol !== SYMBOL || !finiteNumber(item.price) || !finiteNumber(item.amount) || !validTimestamp(item.ts)) throw new Error("shape/numeric: liquidation row");
    }
    return summarize(data);
  }),
  request("spot instruments", `/api/v3/market/instruments?category=SPOT&symbol=${SYMBOL}`, arrayProbe("SPOT")),
  request("spot ticker", `/api/v3/market/tickers?category=SPOT&symbol=${SYMBOL}`, arrayProbe("SPOT", ["lastPrice", "price24hPcnt", "turnover24h"])),
];

async function main() {
  const results = await Promise.all(probes);
  let failures = 0;
  for (const result of results) {
    if (!result.ok) failures += 1;
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name} ${result.latencyMs}ms ${result.summary}${result.error ? ` — ${result.error}` : ""}`);
  }
  if (failures > 0) {
    console.error(`Public Bitget smoke: FAIL (${failures}/${results.length})`);
    process.exitCode = 1;
  } else {
    console.log(`Public Bitget smoke: PASS (${results.length}/${results.length})`);
  }
}

void main();
