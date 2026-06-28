/** Единая политика таймаутов MOEX ISS для screener и ingest. */

export function getMoexHttpTimeoutMs(): number {
  const fromEnv = process.env.MOEX_HTTP_TIMEOUT_MS?.trim();
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (Number.isFinite(parsed) && parsed >= 3_000) {
      return Math.min(parsed, 15_000);
    }
  }
  return 12_000;
}

export function getMoexHttpRetries(): number {
  return 0;
}
