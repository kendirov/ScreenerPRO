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

/** Vercel injects git metadata at build time — safe to expose in /api/screener/health. */
export function getVercelGitMetadata(): {
  commitSha: string | null;
  commitMessage: string | null;
  branch: string | null;
  deploymentUrl: string | null;
} {
  const rawSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? null;
  const rawMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE?.trim() ?? null;
  const branch = process.env.VERCEL_GIT_COMMIT_REF?.trim() ?? null;
  const vercelUrl = process.env.VERCEL_URL?.trim() ?? null;

  return {
    commitSha: rawSha && rawSha.length > 0 ? rawSha : null,
    commitMessage: rawMessage ? rawMessage.slice(0, 240) : null,
    branch: branch && branch.length > 0 ? branch : null,
    deploymentUrl: vercelUrl ? (vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`) : null,
  };
}
