/** Runtime flags for screener data sources (MOEX vs local SQLite vs demo). */

export function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true" || Boolean(process.env.VERCEL_ENV);
}

export function isDemoFallbackAllowed(): boolean {
  const flag = process.env.ALLOW_DEMO_MARKET_DATA?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}

/** SQLite baselines are local-dev only; never block live MOEX on serverless/production. */
export function canUsePrismaHistoricalBaselines(): boolean {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (!url.startsWith("file:")) return false;
  if (process.env.NODE_ENV === "production") return false;
  if (isVercelRuntime()) return false;
  return true;
}

export function getScreenerEnvironment(): "development" | "production" {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function getBuildCommit(): string | null {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? null;
  if (!sha) return null;
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}
