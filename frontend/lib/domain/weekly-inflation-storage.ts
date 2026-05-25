import {
  buildWeeklyInflationDashboard,
  formatInflationPct,
  formatPeriodLabel,
  loadManualPointsFromStorage,
  saveManualPointsToStorage,
  WEEKLY_INFLATION_STORAGE_KEY,
  type InflationRegime,
  type WeeklyInflationDashboard,
  type WeeklyInflationPoint,
} from "@/lib/domain/weekly-inflation";

export { WEEKLY_INFLATION_STORAGE_KEY };

export const INFLATION_BRIEF_REGIME_LABELS: Record<InflationRegime, string> = {
  disinflation: "замедление",
  neutral: "нейтрально",
  pressure: "давление",
  shock: "шок",
  "no-data": "нет данных",
};

export type WeeklyInflationBrief = {
  hasData: boolean;
  headlineLabel: string;
  avg4wLabel: string;
  annualized4wLabel: string;
  regimeLabel: string;
  periodLabel: string | null;
  airOrderLine: string;
  telegramLine: string | null;
};

export const WEEKLY_INFLATION_UPDATED_EVENT = "weekly-inflation-updated";

export function loadWeeklyInflationPoints(): WeeklyInflationPoint[] {
  return loadManualPointsFromStorage();
}

export function saveWeeklyInflationPoints(points: WeeklyInflationPoint[]): void {
  saveManualPointsToStorage(points);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WEEKLY_INFLATION_UPDATED_EVENT));
  }
}

export function getWeeklyInflationDashboard(): WeeklyInflationDashboard {
  return buildWeeklyInflationDashboard(loadWeeklyInflationPoints());
}

export function getLatestInflationBrief(): WeeklyInflationBrief {
  const dashboard = getWeeklyInflationDashboard();
  const hasData = dashboard.points.some((point) => point.headlinePct != null);

  if (!hasData) {
    return {
      hasData: false,
      headlineLabel: "данные не загружены",
      avg4wLabel: "—",
      annualized4wLabel: "—",
      regimeLabel: INFLATION_BRIEF_REGIME_LABELS["no-data"],
      periodLabel: null,
      airOrderLine: "Недельная инфляция: данные не загружены.",
      telegramLine: null,
    };
  }

  const { latest, metrics } = dashboard;
  const headlineLabel = formatInflationPct(latest?.headlinePct ?? null);
  const avg4wLabel = metrics.avg4w != null ? formatInflationPct(metrics.avg4w) : "—";
  const annualized4wLabel =
    metrics.annualized4w != null ? formatInflationPct(metrics.annualized4w) : "—";
  const regimeLabel = INFLATION_BRIEF_REGIME_LABELS[metrics.regime];

  return {
    hasData: true,
    headlineLabel,
    avg4wLabel,
    annualized4wLabel,
    regimeLabel,
    periodLabel: formatPeriodLabel(latest),
    airOrderLine: `Недельная инфляция: ${headlineLabel}, 4w avg: ${avg4wLabel}, годовой темп: ${annualized4wLabel}, режим: ${regimeLabel}.`,
    telegramLine: `Инфляция: недельная ${headlineLabel}, 4w avg ${avg4wLabel}; для рынка — ${regimeLabel}.`,
  };
}
