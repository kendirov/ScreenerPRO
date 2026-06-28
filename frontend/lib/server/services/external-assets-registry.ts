import type { ExternalAssetGroupId, ExternalThresholdGroup } from "@/lib/preparation/preparation-types";

export type ExternalAssetDef = {
  id: string;
  name: string;
  group: ExternalAssetGroupId;
  provider: "yahoo";
  symbol: string;
  /** Ordered fallback symbols tried when primary fails. */
  fallbackSymbols?: string[];
  thresholdGroup: ExternalThresholdGroup;
  critical: boolean;
  active: boolean;
  disabledReason?: string;
};

export const EXTERNAL_ASSETS_REGISTRY: ExternalAssetDef[] = [
  // US indices
  { id: "sp500", name: "S&P 500", group: "indices", provider: "yahoo", symbol: "^GSPC", thresholdGroup: "indices", critical: true, active: true },
  { id: "nasdaq100", name: "Nasdaq 100", group: "indices", provider: "yahoo", symbol: "^NDX", thresholdGroup: "indices", critical: true, active: true },
  { id: "dow", name: "Dow Jones", group: "indices", provider: "yahoo", symbol: "^DJI", thresholdGroup: "indices", critical: false, active: true },
  { id: "russell2000", name: "Russell 2000", group: "indices", provider: "yahoo", symbol: "^RUT", thresholdGroup: "indices", critical: false, active: true },
  // Europe
  { id: "dax", name: "DAX", group: "indices", provider: "yahoo", symbol: "^GDAXI", thresholdGroup: "indices", critical: false, active: true },
  { id: "eurostoxx50", name: "Euro Stoxx 50", group: "indices", provider: "yahoo", symbol: "^STOXX50E", thresholdGroup: "indices", critical: false, active: true },
  { id: "ftse100", name: "FTSE 100", group: "indices", provider: "yahoo", symbol: "^FTSE", thresholdGroup: "indices", critical: false, active: true },
  { id: "cac40", name: "CAC 40", group: "indices", provider: "yahoo", symbol: "^FCHI", thresholdGroup: "indices", critical: false, active: true },
  // Asia
  { id: "nikkei225", name: "Nikkei 225", group: "indices", provider: "yahoo", symbol: "^N225", thresholdGroup: "indices", critical: false, active: true },
  { id: "hangseng", name: "Hang Seng", group: "indices", provider: "yahoo", symbol: "^HSI", thresholdGroup: "indices", critical: false, active: true },
  { id: "csi300", name: "CSI 300", group: "indices", provider: "yahoo", symbol: "000300.SS", thresholdGroup: "indices", critical: false, active: true },
  { id: "shanghai", name: "Shanghai Composite", group: "indices", provider: "yahoo", symbol: "000001.SS", thresholdGroup: "indices", critical: false, active: true },
  { id: "kospi", name: "KOSPI", group: "indices", provider: "yahoo", symbol: "^KS11", thresholdGroup: "indices", critical: false, active: true },
  { id: "asx200", name: "ASX 200", group: "indices", provider: "yahoo", symbol: "^AXJO", thresholdGroup: "indices", critical: false, active: true },
  { id: "nifty50", name: "Nifty 50", group: "indices", provider: "yahoo", symbol: "^NSEI", thresholdGroup: "indices", critical: false, active: true },
  // FX
  { id: "dxy", name: "DXY", group: "fx", provider: "yahoo", symbol: "DX-Y.NYB", fallbackSymbols: ["UUP"], thresholdGroup: "fx", critical: true, active: true },
  { id: "eurusd", name: "EUR/USD", group: "fx", provider: "yahoo", symbol: "EURUSD=X", thresholdGroup: "fx", critical: false, active: true },
  { id: "usdjpy", name: "USD/JPY", group: "fx", provider: "yahoo", symbol: "USDJPY=X", thresholdGroup: "fx", critical: false, active: true },
  { id: "usdrub", name: "USD/RUB", group: "fx", provider: "yahoo", symbol: "RUB=X", thresholdGroup: "fx", critical: false, active: true },
  {
    id: "cnyrub",
    name: "CNY/RUB",
    group: "fx",
    provider: "yahoo",
    symbol: "CNYRUB=X",
    thresholdGroup: "fx",
    critical: false,
    active: false,
    disabledReason: "Yahoo CNYRUB=X: недостаточно истории (<2 точек)",
  },
  // Energy
  { id: "brent", name: "Brent", group: "energy", provider: "yahoo", symbol: "BZ=F", thresholdGroup: "energy", critical: true, active: true },
  { id: "wti", name: "WTI", group: "energy", provider: "yahoo", symbol: "CL=F", thresholdGroup: "energy", critical: false, active: true },
  { id: "natgas", name: "Natural Gas US", group: "energy", provider: "yahoo", symbol: "NG=F", thresholdGroup: "energy", critical: true, active: true },
  // Metals
  { id: "gold", name: "Gold", group: "metals", provider: "yahoo", symbol: "GC=F", thresholdGroup: "metals", critical: true, active: true },
  { id: "silver", name: "Silver", group: "metals", provider: "yahoo", symbol: "SI=F", thresholdGroup: "metals", critical: false, active: true },
  { id: "platinum", name: "Platinum", group: "metals", provider: "yahoo", symbol: "PL=F", thresholdGroup: "metals", critical: false, active: true },
  { id: "palladium", name: "Palladium", group: "metals", provider: "yahoo", symbol: "PA=F", thresholdGroup: "metals", critical: false, active: true },
  { id: "copper", name: "Copper", group: "metals", provider: "yahoo", symbol: "HG=F", thresholdGroup: "metals", critical: true, active: true },
  { id: "aluminium", name: "Aluminium", group: "metals", provider: "yahoo", symbol: "ALI=F", thresholdGroup: "metals", critical: false, active: true },
  {
    id: "nickel",
    name: "Nickel",
    group: "metals",
    provider: "yahoo",
    symbol: "NI=F",
    thresholdGroup: "metals",
    critical: false,
    active: false,
    disabledReason: "Yahoo NI=F недоступен (404)",
  },
  // Soft
  { id: "coffee", name: "Coffee", group: "soft", provider: "yahoo", symbol: "KC=F", thresholdGroup: "soft", critical: false, active: true },
  { id: "cocoa", name: "Cocoa", group: "soft", provider: "yahoo", symbol: "CC=F", thresholdGroup: "soft", critical: false, active: true },
  { id: "wheat", name: "Wheat", group: "soft", provider: "yahoo", symbol: "ZW=F", thresholdGroup: "soft", critical: false, active: true },
  { id: "corn", name: "Corn", group: "soft", provider: "yahoo", symbol: "ZC=F", thresholdGroup: "soft", critical: false, active: true },
  { id: "soybeans", name: "Soybeans", group: "soft", provider: "yahoo", symbol: "ZS=F", thresholdGroup: "soft", critical: false, active: true },
];

export function findExternalAsset(id: string): ExternalAssetDef | undefined {
  return EXTERNAL_ASSETS_REGISTRY.find((a) => a.id === id);
}

export function getActiveExternalAssets(): ExternalAssetDef[] {
  return EXTERNAL_ASSETS_REGISTRY.filter((a) => a.active);
}

export function getCriticalExternalAssets(): ExternalAssetDef[] {
  return EXTERNAL_ASSETS_REGISTRY.filter((a) => a.active && a.critical);
}

export function getDisabledExternalAssets(): ExternalAssetDef[] {
  return EXTERNAL_ASSETS_REGISTRY.filter((a) => !a.active);
}
