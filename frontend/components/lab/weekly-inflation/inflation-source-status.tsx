"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import {
  ADAPTER_ROLE_LABELS,
  ADAPTER_STATUS_LABELS,
  formatFetchResultLabel,
  type WeeklyInflationAdapterStatus,
  type WeeklyInflationFetchResponse,
  type WeeklyInflationSourceAdapter,
} from "@/lib/domain/weekly-inflation-sources";
import {
  formatPeriodLabel,
  WEEKLY_INFLATION_SOURCE_LABELS,
  type WeeklyInflationDashboard,
  type WeeklyInflationOfficialPublication,
  type WeeklyInflationPoint,
} from "@/lib/domain/weekly-inflation";
import {
  checkWeeklyInflationSource,
  useWeeklyInflationSourceStatus,
} from "@/lib/hooks/use-weekly-inflation-sources";
import { cn } from "@/lib/utils/cn";

const inputClass =
  "w-full rounded-lg border border-lab-border bg-lab-bg-deep/60 px-2.5 py-1.5 text-sm text-lab-text outline-none focus:border-lab-violet/40";

export function InflationSourceStatus({
  dashboard,
  officialPublication,
  onApplyFetchedPoints,
  className,
}: {
  dashboard: WeeklyInflationDashboard;
  officialPublication: WeeklyInflationOfficialPublication | null;
  onApplyFetchedPoints?: (points: WeeklyInflationPoint[]) => void;
  className?: string;
}) {
  const statusQuery = useWeeklyInflationSourceStatus();
  const [checkUrl, setCheckUrl] = React.useState(officialPublication?.url ?? "");
  const [indicatorId, setIndicatorId] = React.useState("");
  const [checkSource, setCheckSource] = React.useState<"rosstat" | "fedstat">("rosstat");
  const [checkResult, setCheckResult] = React.useState<WeeklyInflationFetchResponse | null>(null);
  const [checking, setChecking] = React.useState(false);

  React.useEffect(() => {
    if (officialPublication?.url) setCheckUrl(officialPublication.url);
  }, [officialPublication?.url]);

  const { latest, points } = dashboard;
  const activeSource = latest?.source ?? "manual";
  const numberSourceLabel = points.length > 0 ? WEEKLY_INFLATION_SOURCE_LABELS[activeSource] : "не загружены";
  const calendarSourceLabel = "Smart-Lab Calendar (план)";
  const verificationLabel = officialPublication?.verifiedManually ? "проверено вручную" : "не проверено";
  const updatedLabel = latest
    ? formatPeriodLabel(latest) ?? latest.periodEnd
    : officialPublication?.publishedAt || "—";

  const handleCheck = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await checkWeeklyInflationSource(checkSource, {
        url: checkUrl.trim() || undefined,
        indicatorId: indicatorId.trim() || undefined,
      });
      setCheckResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось проверить источник.";
      setCheckResult({
        source: checkSource,
        status: "error",
        updatedAt: new Date().toISOString(),
        points: [],
        diagnostics: { parsedPoints: 0, warnings: [message] },
      });
    } finally {
      setChecking(false);
    }
  };

  const adapters = statusQuery.data?.adapters ?? [];
  const numberAdapters = adapters.filter((a) => a.role === "number" || a.role === "verification");
  const otherAdapters = adapters.filter((a) => a.role === "calendar" || a.role === "commentary");

  return (
    <section className={cn("lab-glass-panel p-4", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <LabSectionHeading className="mb-0">Источник данных</LabSectionHeading>
        <button
          type="button"
          onClick={() => statusQuery.refetch()}
          disabled={statusQuery.isFetching}
          className="inline-flex items-center gap-1 rounded-lg border border-lab-border px-2 py-1 text-[11px] text-lab-muted hover:text-lab-text"
        >
          {statusQuery.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          обновить статус
        </button>
      </div>

      <dl className="mb-4 grid gap-2 rounded-xl border border-lab-border/80 bg-lab-bg-deep/30 px-3 py-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetaItem label="Источник цифры" value={numberSourceLabel} />
        <MetaItem label="Источник календаря" value={calendarSourceLabel} />
        <MetaItem
          label="Статус"
          value={points.length > 0 ? `${points.length} нед. в ряде` : "данные не загружены"}
        />
        <MetaItem label="Последнее обновление" value={updatedLabel} />
        <MetaItem label="Проверка" value={verificationLabel} />
        {officialPublication?.url ? (
          <MetaItem label="Official URL" value={officialPublication.sourceName} hint={officialPublication.url} />
        ) : (
          <MetaItem label="Official URL" value="не сохранён" />
        )}
      </dl>

      <div className="mb-4 rounded-xl border border-lab-violet/20 bg-lab-violet/5 px-3 py-3">
        <p className="text-xs font-medium text-lab-text">Проверить источник (эксперимент)</p>
        <p className="mt-1 text-[11px] text-lab-muted">
          Росстат / Fedstat — безопасная загрузка URL. Если парсинг не удался, используйте CSV вручную.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Источник">
            <select value={checkSource} onChange={(e) => setCheckSource(e.target.value as "rosstat" | "fedstat")} className={inputClass}>
              <option value="rosstat">Росстат</option>
              <option value="fedstat">Fedstat / ЕМИСС</option>
            </select>
          </Field>
          <Field label="Official URL">
            <input type="url" value={checkUrl} onChange={(e) => setCheckUrl(e.target.value)} placeholder="https://..." className={inputClass} />
          </Field>
          <Field label="indicatorId (опц.)">
            <input type="text" value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)} placeholder="без хардкода" className={inputClass} />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-lab-violet/30 bg-lab-violet/10 px-3 py-1.5 text-sm text-lab-text hover:bg-lab-violet/15 disabled:opacity-60"
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Проверить источник
            </button>
          </div>
        </div>

        {checkResult ? (
          <div className="mt-3 rounded-lg border border-lab-amber/25 bg-lab-amber/5 px-3 py-2 text-[11px] text-lab-muted">
            <p className="font-medium text-lab-text">{formatFetchResultLabel(checkResult)}</p>
            {checkResult.diagnostics.contentType ? (
              <p className="mt-1">content-type: {checkResult.diagnostics.contentType}</p>
            ) : null}
            {checkResult.diagnostics.warnings.map((warning) => (
              <p key={warning} className="mt-1">• {warning}</p>
            ))}
            {checkResult.status === "ok" && checkResult.points.length > 0 && onApplyFetchedPoints ? (
              <button
                type="button"
                onClick={() => onApplyFetchedPoints(checkResult.points)}
                className="mt-2 rounded-lg border border-lab-cyan/30 bg-lab-cyan/10 px-2.5 py-1 text-[11px] text-lab-text hover:bg-lab-cyan/15"
              >
                Применить {checkResult.points.length} нед. к ряду
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {statusQuery.data?.warnings?.length ? (
        <ul className="mb-4 space-y-1 rounded-xl border border-lab-violet/20 bg-lab-violet/5 px-3 py-2 text-[11px] text-lab-muted">
          {statusQuery.data.warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      ) : null}

      {statusQuery.isError ? (
        <p className="mb-3 text-sm text-lab-amber">Статус адаптеров временно недоступен — ручной CSV продолжает работать.</p>
      ) : null}

      <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-lab-dim">Главные источники</p>
      <div className="grid gap-2 lg:grid-cols-2">
        {numberAdapters.map((adapter) => (
          <AdapterCard key={adapter.id} adapter={adapter} />
        ))}
      </div>

      {otherAdapters.length > 0 ? (
        <>
          <p className="mb-2 mt-4 text-[10px] uppercase tracking-[0.1em] text-lab-dim">Календарь и комментарий</p>
          <div className="grid gap-2 lg:grid-cols-2">
            {otherAdapters.map((adapter) => (
              <AdapterCard key={adapter.id} adapter={adapter} />
            ))}
          </div>
        </>
      ) : null}

      {statusQuery.data?.updatedAt ? (
        <p className="mt-3 font-mono text-[10px] text-lab-dim">
          статус API: {new Date(statusQuery.data.updatedAt).toLocaleString("ru-RU")}
        </p>
      ) : null}
    </section>
  );
}

function MetaItem({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.1em] text-lab-dim">{label}</dt>
      <dd className="mt-0.5 text-sm text-lab-text">{value}</dd>
      {hint ? <dd className="mt-0.5 truncate font-mono text-[10px] text-lab-muted">{hint}</dd> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase tracking-[0.1em] text-lab-dim">{label}</span>
      {children}
    </label>
  );
}

function AdapterCard({ adapter }: { adapter: WeeklyInflationSourceAdapter }) {
  const tone = resolveAdapterTone(adapter.status);

  return (
    <div className={cn("rounded-xl border px-3 py-3", tone.border, tone.bg)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-lab-text">{adapter.title}</p>
          <p className="mt-0.5 text-[11px] text-lab-muted">{adapter.description}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className={cn("lab-chip px-2 py-0.5 text-[10px]", tone.chip)}>{ADAPTER_STATUS_LABELS[adapter.status]}</span>
          <span className="lab-chip px-2 py-0.5 text-[10px] text-lab-muted">{ADAPTER_ROLE_LABELS[adapter.role]}</span>
        </div>
      </div>

      <dl className="mt-3 space-y-1.5 text-[11px]">
        <div>
          <dt className="text-lab-dim">Что даёт</dt>
          <dd className="text-lab-muted">{adapter.provides}</dd>
        </div>
        <div>
          <dt className="text-lab-dim">Ограничение</dt>
          <dd className="text-lab-muted">{adapter.limitation}</dd>
        </div>
      </dl>
    </div>
  );
}

function resolveAdapterTone(status: WeeklyInflationAdapterStatus): {
  border: string;
  bg: string;
  chip: string;
} {
  switch (status) {
    case "connected":
      return {
        border: "border-lab-cyan/25",
        bg: "bg-lab-cyan/5",
        chip: "border-lab-cyan/30 bg-lab-cyan/10 text-lab-cyan",
      };
    case "experimental":
      return {
        border: "border-lab-amber/25",
        bg: "bg-lab-amber/5",
        chip: "border-lab-amber/30 bg-lab-amber/10 text-lab-amber",
      };
    case "planned":
      return {
        border: "border-lab-violet/20",
        bg: "bg-lab-violet/5",
        chip: "border-lab-violet/25 bg-lab-violet/8 text-lab-violet",
      };
    case "error":
      return {
        border: "border-lab-red/25",
        bg: "bg-lab-red/5",
        chip: "border-lab-red/30 bg-lab-red/10 text-lab-red",
      };
    default:
      return {
        border: "border-lab-border",
        bg: "bg-lab-bg-deep/30",
        chip: "text-lab-muted",
      };
  }
}
