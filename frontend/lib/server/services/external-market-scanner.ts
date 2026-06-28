import {
  CRITICAL_FALLBACK_IDS,
  EXTERNAL_GROUP_TITLES,
  EXTERNAL_THRESHOLDS,
  isStrongMove,
} from "@/lib/preparation/external-thresholds";
import type {
  ExternalAssetGroupId,
  ExternalAssetQuote,
  ExternalAssetTag,
  ExternalMarketGroup,
  ExternalMarketResponse,
  ExternalMarketStatus,
  ExternalMarketSummary,
  ExternalRiskTone,
} from "@/lib/preparation/preparation-types";
import {
  EXTERNAL_ASSETS_REGISTRY,
  getActiveExternalAssets,
  getCriticalExternalAssets,
  getDisabledExternalAssets,
} from "@/lib/server/services/external-assets-registry";
import { fetchAllExternalQuotes } from "@/lib/server/services/external-market-provider";

const CACHE_TTL_MS = 5 * 60_000;

let cache: { expiresAt: number; payload: ExternalMarketResponse } | null = null;

function assignTags(quote: ExternalAssetQuote): ExternalAssetTag[] {
  const tags: ExternalAssetTag[] = [];
  const def = EXTERNAL_ASSETS_REGISTRY.find((a) => a.id === quote.id);
  const thresholds = EXTERNAL_THRESHOLDS[def?.thresholdGroup ?? "indices"];
  const c1 = quote.change1dPct ?? 0;
  const c5 = quote.change5dPct ?? 0;

  if (Math.abs(c1) >= thresholds.change1d * (quote.critical ? 0.75 : 1)) tags.push("1D");
  if (Math.abs(c5) >= thresholds.change5d * (quote.critical ? 0.75 : 1)) tags.push("5D");
  if ((quote.range5dPct ?? 0) >= thresholds.range5d) tags.push("range");
  if (c1 * c5 < 0 && Math.abs(c1) >= 0.4 && Math.abs(c5) >= 1) tags.push("reversal");

  return tags;
}

function scoreQuote(quote: ExternalAssetQuote): ExternalAssetQuote | null {
  if (quote.series5d.length < 2 || quote.error) {
    if (quote.critical) return { ...quote, isMover: false, tags: [] };
    return null;
  }

  const def = EXTERNAL_ASSETS_REGISTRY.find((a) => a.id === quote.id);
  const thresholds = EXTERNAL_THRESHOLDS[def?.thresholdGroup ?? "indices"];
  const isMover = isStrongMove({
    change1dPct: quote.change1dPct,
    change5dPct: quote.change5dPct,
    range5dPct: quote.range5dPct,
    thresholds,
    critical: quote.critical,
  });

  const scored = { ...quote, isMover, tags: [] as ExternalAssetTag[] };
  scored.tags = assignTags(scored);
  return scored;
}

function buildSummary(quotes: ExternalAssetQuote[], moversCount: number): ExternalMarketSummary {
  const byId = new Map(quotes.map((q) => [q.id, q]));
  const sp = byId.get("sp500");
  const ndx = byId.get("nasdaq100");
  const dxy = byId.get("dxy");
  const brent = byId.get("brent");
  const gold = byId.get("gold");
  const gas = byId.get("natgas");

  let riskScore = 0;
  for (const idx of [sp, ndx]) {
    const c = idx?.change1dPct ?? 0;
    if (c >= 0.5) riskScore += 1;
    if (c <= -0.5) riskScore -= 1;
  }
  if ((dxy?.change1dPct ?? 0) >= 0.4) riskScore -= 0.5;
  if ((brent?.change1dPct ?? 0) >= 1.5) riskScore += 0.3;
  if ((gold?.change1dPct ?? 0) >= 0.8) riskScore -= 0.3;
  if ((gas?.change1dPct ?? 0) >= 3) riskScore += 0.2;

  let tone: ExternalRiskTone = "mixed";
  if (moversCount === 0) tone = "calm";
  else if (riskScore >= 1.2) tone = "risk-on";
  else if (riskScore <= -1.2) tone = "risk-off";
  else if ((brent?.change1dPct ?? 0) >= 2 || (gold?.change1dPct ?? 0) >= 1.5) tone = "commodity";
  else if ((dxy?.change1dPct ?? 0) >= 0.5) tone = "dollar-pressure";

  const parts: string[] = [];
  if (brent?.change1dPct != null) parts.push(`нефть ${formatSigned(brent.change1dPct)}`);
  if (dxy?.change1dPct != null) parts.push(`DXY ${formatSigned(dxy.change1dPct)}`);
  if (ndx?.change1dPct != null) parts.push(`Nasdaq ${formatSigned(ndx.change1dPct)}`);

  const toneLabel: Record<ExternalRiskTone, string> = {
    "risk-on": "Фон риск-он",
    "risk-off": "Фон риск-офф",
    mixed: "Фон смешанный",
    calm: "Сильных движений нет",
    commodity: "Сырьевой фон сильный",
    "dollar-pressure": "Доллар давит",
  };

  const line =
    moversCount === 0
      ? toneLabel.calm
      : parts.length
        ? `${toneLabel[tone]}: ${parts.join(", ")}`
        : toneLabel[tone];

  return { tone, line, moversCount };
}

function formatSigned(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1).replace(".", ",")}%`;
}

function resolveExternalStatus(criticalSuccessRate: number, moversCount: number): ExternalMarketStatus {
  if (criticalSuccessRate === 0) return "error";
  if (criticalSuccessRate >= 0.8) return "live";
  if (criticalSuccessRate >= 0.5 && moversCount > 0) return "partial";
  return "degraded";
}

function groupQuotes(
  quotes: ExternalAssetQuote[],
  groupId: ExternalAssetGroupId,
  globalNoMovers: boolean,
): ExternalMarketGroup {
  const valid = quotes.filter((q) => q.group === groupId);
  const movers = valid.filter((q) => q.isMover);
  const criticalIds = new Set<string>(CRITICAL_FALLBACK_IDS);
  const critical =
    globalNoMovers ? valid.filter((q) => criticalIds.has(q.id)).slice(0, 8) : [];

  return {
    id: groupId,
    title: EXTERNAL_GROUP_TITLES[groupId],
    movers,
    critical,
  };
}

export async function buildExternalMarketResponse(): Promise<ExternalMarketResponse> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.payload;
  }

  const activeAssets = getActiveExternalAssets();
  const criticalAssets = getCriticalExternalAssets();
  const disabledAssets = getDisabledExternalAssets();

  const { quotes: rawQuotes, diagnostics: assetDiagnostics } = await fetchAllExternalQuotes(activeAssets);
  const scored = rawQuotes.map(scoreQuote).filter((q): q is ExternalAssetQuote => q != null);

  const criticalOk = criticalAssets.filter((def) => {
    const diag = assetDiagnostics.find((d) => d.id === def.id);
    return diag?.status === "ok";
  }).length;
  const criticalSuccessRate = criticalAssets.length ? criticalOk / criticalAssets.length : 0;

  const moversCount = scored.filter((q) => q.isMover).length;
  const status = resolveExternalStatus(criticalSuccessRate, moversCount);
  const globalNoMovers = moversCount === 0;

  const groupIds: ExternalAssetGroupId[] = ["indices", "fx", "energy", "metals", "soft"];
  const groups = groupIds
    .map((id) => groupQuotes(scored, id, globalNoMovers))
    .filter((g) => g.movers.length > 0 || g.critical.length > 0);

  const errors = assetDiagnostics
    .filter((d) => d.status === "error" || d.status === "insufficient")
    .map((d) => `${d.id}: ${d.error ?? d.status}`);

  const summary = buildSummary(scored, moversCount);

  const payload: ExternalMarketResponse = {
    status,
    updatedAt: new Date().toISOString(),
    summary,
    groups,
    allAssetsCount: EXTERNAL_ASSETS_REGISTRY.length,
    activeAssetsCount: activeAssets.length,
    disabledAssetsCount: disabledAssets.length,
    criticalAssetsCount: criticalAssets.length,
    criticalSuccessRate,
    moversCount,
    errors,
    diagnostics: [
      `registry=${EXTERNAL_ASSETS_REGISTRY.length}`,
      `active=${activeAssets.length}`,
      `disabled=${disabledAssets.length}`,
      `critical=${criticalAssets.length}`,
      `criticalOk=${criticalOk}`,
      `criticalRate=${(criticalSuccessRate * 100).toFixed(0)}%`,
      `movers=${moversCount}`,
      `source=yahoo-finance`,
    ],
    assetDiagnostics: [
      ...assetDiagnostics,
      ...disabledAssets.map((a) => ({
        id: a.id,
        name: a.name,
        group: a.group,
        symbol: a.symbol,
        provider: a.provider,
        status: "disabled" as const,
        points: 0,
        firstDate: null,
        lastDate: null,
        firstValue: null,
        lastValue: null,
        min: null,
        max: null,
        error: a.disabledReason,
      })),
    ],
  };

  cache = { expiresAt: Date.now() + CACHE_TTL_MS, payload };
  return payload;
}

export function clearExternalMarketCache(): void {
  cache = null;
}
