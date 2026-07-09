import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";

/** Bump when Strategy Lab chart bundle changes — used for stale-client detection. */
export const STRATEGY_CHART_COMPONENT_VERSION = "2026-07-07-browser-parity-1";
export const STRATEGY_LAB_PAGE_VERSION = "2026-07-07-browser-parity-1";
export const STRATEGY_LAB_RUNTIME_VERSION = "strategy-lab-chart-v3-self-healing";

const RUNTIME_MARKER_STORAGE_KEY = "screener.strategyLab.runtimeMarker";
const CHART_VERSION_STORAGE_KEY = "screener.strategyChart.componentVersion";
const RUNTIME_VERSION_STORAGE_KEY = "screener.strategyLab.runtimeVersion";

export type StrategyLabRuntimeMarker = {
  runtimeSessionId: string;
  mountedAt: string;
  bundleVersion: string;
};

export type StrategyLocalStorageEntry = {
  key: string;
  value: string | null;
  present: boolean;
  chartRisk: boolean;
  note?: string;
};

export type StrategyBrowserParityDiagnostics = {
  collectedAt: string;
  userAgent: string;
  currentUrl: string;
  routeMountedAt: string;
  routeMountCount: number;
  chartMountCount: number;
  runtimeSessionId: string;
  bundleMountedAt: string;
  bundleVersion: string;
  runtimeVersion: string;
  expectedRuntimeVersion: string;
  chartComponentVersion: string;
  chartComponentVersionRegistered: boolean;
  registeredChartVersion: string | null;
  staleBundleWarning: string | null;
  chartReadyRevision: number;
  dataRevision: number;
  candlesVersionHash: string;
  setDataCallCount: number;
  lastSetDataAt: string | null;
  lastSetDataReason: string | null;
  devicePixelRatio: number;
  overlaysEnabled: boolean;
  localStorageEntries: StrategyLocalStorageEntry[];
};

const STRATEGY_LAB_STORAGE_SPECS: Array<
  Pick<StrategyLocalStorageEntry, "key" | "chartRisk" | "note">
> = [
  { key: "screener.strategyLab.secid", chartRisk: false, note: "selected instrument" },
  { key: "screener.strategyLab.timeframe", chartRisk: false, note: "timeframe minutes" },
  { key: "screener.strategyLab.dataSource", chartRisk: true, note: "can force synthetic/offline candles" },
  { key: "screener.strategyLab.chartDebugSource", chartRisk: true, note: "moex vs synthetic override" },
  { key: "screener.strategyLab.overlays", chartRisk: true, note: "overlay toggle persistence" },
  { key: "screener.strategyLab.layers", chartRisk: true, note: "strategy layer toggles" },
  { key: "screener.strategyChart.componentVersion", chartRisk: false, note: "last registered chart bundle" },
  { key: RUNTIME_MARKER_STORAGE_KEY, chartRisk: false, note: "runtime session marker" },
  { key: RUNTIME_VERSION_STORAGE_KEY, chartRisk: false, note: "current runtime version marker" },
];

let runtimeMarker: StrategyLabRuntimeMarker | null = null;
let strategyLabPageMountCount = 0;
let strategyChartMountCount = 0;
let registeredChartVersion: string | null = null;

function shortSessionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function ensureStrategyLabRuntimeMarker(): StrategyLabRuntimeMarker {
  if (typeof window === "undefined") {
    return {
      runtimeSessionId: "ssr",
      mountedAt: "",
      bundleVersion: STRATEGY_LAB_PAGE_VERSION,
    };
  }

  if (runtimeMarker) return runtimeMarker;

  try {
    const raw = sessionStorage.getItem(RUNTIME_MARKER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StrategyLabRuntimeMarker>;
      if (
        typeof parsed.runtimeSessionId === "string" &&
        typeof parsed.mountedAt === "string" &&
        typeof parsed.bundleVersion === "string"
      ) {
        runtimeMarker = parsed as StrategyLabRuntimeMarker;
        return runtimeMarker;
      }
    }
  } catch {
    // ignore corrupt marker
  }

  runtimeMarker = {
    runtimeSessionId: shortSessionId(),
    mountedAt: new Date().toISOString(),
    bundleVersion: STRATEGY_LAB_PAGE_VERSION,
  };

  try {
    sessionStorage.setItem(RUNTIME_MARKER_STORAGE_KEY, JSON.stringify(runtimeMarker));
    sessionStorage.setItem(RUNTIME_VERSION_STORAGE_KEY, STRATEGY_LAB_RUNTIME_VERSION);
  } catch {
    // ignore quota / private mode
  }

  return runtimeMarker;
}

export function bumpStrategyLabPageMountCount(): number {
  strategyLabPageMountCount += 1;
  return strategyLabPageMountCount;
}

export function getStrategyLabPageMountCount(): number {
  return strategyLabPageMountCount;
}

export function bumpStrategyChartMountCount(): number {
  strategyChartMountCount += 1;
  return strategyChartMountCount;
}

export function getStrategyChartMountCount(): number {
  return strategyChartMountCount;
}

export function registerStrategyChartComponentVersion(): string {
  registeredChartVersion = STRATEGY_CHART_COMPONENT_VERSION;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(CHART_VERSION_STORAGE_KEY, STRATEGY_CHART_COMPONENT_VERSION);
      sessionStorage.setItem(RUNTIME_VERSION_STORAGE_KEY, STRATEGY_LAB_RUNTIME_VERSION);
    } catch {
      // ignore
    }
  }
  return STRATEGY_CHART_COMPONENT_VERSION;
}

export function getRegisteredStrategyChartVersion(): string | null {
  return registeredChartVersion;
}

export function hashStrategyCandlesVersion(candles: StrategyCandle[]): string {
  if (candles.length === 0) return "empty";
  const first = candles[0]!;
  const last = candles[candles.length - 1]!;
  return `${candles.length}:${first.time}:${last.time}:${last.close}`;
}

function matchesStrategyStorageKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.includes("strategy") ||
    lower.startsWith("screener.strategy") ||
    lower.includes("strategylab")
  );
}

export function auditStrategyLabLocalStorage(): StrategyLocalStorageEntry[] {
  if (typeof window === "undefined") return [];

  const entries = new Map<string, StrategyLocalStorageEntry>();

  for (const spec of STRATEGY_LAB_STORAGE_SPECS) {
    const value = window.localStorage.getItem(spec.key);
    entries.set(spec.key, {
      key: spec.key,
      value,
      present: value != null,
      chartRisk: spec.chartRisk,
      note: spec.note,
    });
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || entries.has(key)) continue;
    if (!matchesStrategyStorageKey(key)) continue;
    const value = window.localStorage.getItem(key);
    entries.set(key, {
      key,
      value,
      present: value != null,
      chartRisk: true,
      note: "unlisted strategy-related key",
    });
  }

  return [...entries.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function detectStaleStrategyBundle(options: {
  chartMountCount: number;
  chartComponentVersionRegistered: boolean;
  registeredChartVersion: string | null;
}): string | null {
  const warning = "Client bundle may be stale. Hard refresh or clear site data.";

  if (options.chartMountCount > 0 && !options.chartComponentVersionRegistered) {
    return warning;
  }

  if (
    options.registeredChartVersion != null &&
    options.registeredChartVersion !== STRATEGY_CHART_COMPONENT_VERSION
  ) {
    return warning;
  }

  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(CHART_VERSION_STORAGE_KEY);
      if (stored && stored !== STRATEGY_CHART_COMPONENT_VERSION) {
        return warning;
      }
      const storedRuntimeVersion = sessionStorage.getItem(RUNTIME_VERSION_STORAGE_KEY);
      if (storedRuntimeVersion && storedRuntimeVersion !== STRATEGY_LAB_RUNTIME_VERSION) {
        return warning;
      }
      const markerRaw = sessionStorage.getItem(RUNTIME_MARKER_STORAGE_KEY);
      if (markerRaw) {
        const marker = JSON.parse(markerRaw) as Partial<StrategyLabRuntimeMarker>;
        if (
          typeof marker.bundleVersion === "string" &&
          marker.bundleVersion !== STRATEGY_LAB_PAGE_VERSION
        ) {
          return warning;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export function collectStrategyBrowserParityDiagnostics(options: {
  routeMountedAt: string;
  routeMountCount: number;
  chartMountCount: number;
  chartReadyRevision: number;
  dataRevision: number;
  candles: StrategyCandle[];
  setDataCallCount: number;
  lastSetDataAt: string | null;
  lastSetDataReason: string | null;
  overlaysEnabled: boolean;
}): StrategyBrowserParityDiagnostics {
  const marker = ensureStrategyLabRuntimeMarker();
  const chartComponentVersionRegistered = options.chartMountCount > 0 && registeredChartVersion != null;
  const registeredVersion = registeredChartVersion;

  return {
    collectedAt: new Date().toISOString(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "ssr",
    currentUrl: typeof window !== "undefined" ? window.location.href : "",
    routeMountedAt: options.routeMountedAt,
    routeMountCount: options.routeMountCount,
    chartMountCount: options.chartMountCount,
    runtimeSessionId: marker.runtimeSessionId,
    bundleMountedAt: marker.mountedAt,
    bundleVersion: marker.bundleVersion,
    runtimeVersion:
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(RUNTIME_VERSION_STORAGE_KEY) ?? STRATEGY_LAB_RUNTIME_VERSION
        : STRATEGY_LAB_RUNTIME_VERSION,
    expectedRuntimeVersion: STRATEGY_LAB_RUNTIME_VERSION,
    chartComponentVersion: STRATEGY_CHART_COMPONENT_VERSION,
    chartComponentVersionRegistered,
    registeredChartVersion: registeredVersion,
    staleBundleWarning: detectStaleStrategyBundle({
      chartMountCount: options.chartMountCount,
      chartComponentVersionRegistered,
      registeredChartVersion: registeredVersion,
    }),
    chartReadyRevision: options.chartReadyRevision,
    dataRevision: options.dataRevision,
    candlesVersionHash: hashStrategyCandlesVersion(options.candles),
    setDataCallCount: options.setDataCallCount,
    lastSetDataAt: options.lastSetDataAt,
    lastSetDataReason: options.lastSetDataReason,
    devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    overlaysEnabled: options.overlaysEnabled,
    localStorageEntries: auditStrategyLabLocalStorage(),
  };
}

export function getStrategyLabRuntimeVersion(): string {
  return STRATEGY_LAB_RUNTIME_VERSION;
}

function strategyStorageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !matchesStrategyStorageKey(key)) continue;
    keys.push(key);
  }
  return keys;
}

export function clearStrategyLabBrowserState(): string[] {
  if (typeof window === "undefined") return [];
  const cleared = new Set<string>();

  for (const key of strategyStorageKeys(window.localStorage)) {
    window.localStorage.removeItem(key);
    cleared.add(key);
  }

  for (const key of strategyStorageKeys(window.sessionStorage)) {
    window.sessionStorage.removeItem(key);
    cleared.add(key);
  }

  runtimeMarker = null;
  registeredChartVersion = null;

  return [...cleared].sort((a, b) => a.localeCompare(b));
}

function withChartBustUrl(currentUrl: URL, bustValue: string): URL {
  currentUrl.searchParams.set("chartBust", bustValue);
  if (currentUrl.searchParams.get("screenerChartDebug") !== "1") {
    currentUrl.searchParams.set("screenerChartDebug", "1");
  }
  return currentUrl;
}

export function reloadStrategyLabChartFresh(): void {
  if (typeof window === "undefined") return;
  const nextUrl = withChartBustUrl(new URL(window.location.href), String(Date.now()));
  window.history.replaceState(null, "", nextUrl.toString());
  window.location.reload();
}

export function resetStrategyLabStateAndReload(): string[] {
  const clearedKeys = clearStrategyLabBrowserState();
  if (typeof window === "undefined") return clearedKeys;
  const nextUrl = withChartBustUrl(new URL(window.location.href), String(Date.now()));
  window.location.assign(nextUrl.toString());
  return clearedKeys;
}

export function createEmptyStrategyBrowserParityDiagnostics(): StrategyBrowserParityDiagnostics {
  return collectStrategyBrowserParityDiagnostics({
    routeMountedAt: "",
    routeMountCount: 0,
    chartMountCount: 0,
    chartReadyRevision: 0,
    dataRevision: 0,
    candles: [],
    setDataCallCount: 0,
    lastSetDataAt: null,
    lastSetDataReason: null,
    overlaysEnabled: false,
  });
}
