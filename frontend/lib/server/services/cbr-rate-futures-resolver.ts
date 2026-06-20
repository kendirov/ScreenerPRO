import type { CbrFuturesAssetCode } from "@/lib/domain/cbr-rate-instrument-config";
import { resolveNearestFuturesContract as resolveNearestFromMoex } from "@/lib/moex/moex-instrument-resolver";

export type CbrResolvedFuturesContract = {
  assetCode: CbrFuturesAssetCode;
  secid: string;
  shortName?: string;
  expiryDate?: string;
  turnover?: number | null;
  source: "iss" | "manual" | "unresolved";
  diagnostics: string[];
};

/**
 * @deprecated используйте resolveNearestFuturesContract из @/lib/moex/moex-instrument-resolver
 * Обёртка для CBR candles layer.
 */
export async function resolveNearestFuturesContract(
  assetCode: CbrFuturesAssetCode,
  asOfDate: string,
): Promise<CbrResolvedFuturesContract> {
  const resolved = await resolveNearestFromMoex(assetCode, asOfDate);

  if (resolved.status === "resolved") {
    return {
      assetCode,
      secid: resolved.security,
      expiryDate: resolved.expiryDate,
      source: resolved.source === "manual" ? "manual" : "iss",
      diagnostics: resolved.reason ? [resolved.reason] : [],
    };
  }

  return {
    assetCode,
    secid: "—",
    source: "unresolved",
    diagnostics: [resolved.reason ?? `${assetCode}: контракт не найден`],
  };
}
