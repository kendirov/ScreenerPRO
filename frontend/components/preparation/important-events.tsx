"use client";

import type { EventsProviderDiagnostic, PreparationCalendarEvent } from "@/lib/preparation/preparation-types";
import { cn } from "@/lib/utils/cn";

function impactLine(event: PreparationCalendarEvent): string {
  const parts = event.assetImpact.slice(0, 3).join(" / ");
  const importance =
    event.importance === "high" ? "высокий риск" : event.importance === "medium" ? "средний" : "низкий";
  return parts ? `${importance} · ${parts}` : importance;
}

function EventRow({ event }: { event: PreparationCalendarEvent }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-white/[0.04] py-1.5 last:border-0">
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-lab-text-main">
        {event.timeMsk ?? event.time ?? "—"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] text-lab-text-main">{event.title}</p>
        <p
          className={cn(
            "mt-0.5 truncate font-mono text-[9px]",
            event.importance === "high" ? "text-amber-200/85" : "text-lab-text-dim",
          )}
        >
          {impactLine(event)}
        </p>
      </div>
    </div>
  );
}

function EventBucket({ title, events }: { title: string; events: PreparationCalendarEvent[] }) {
  if (!events.length) return null;
  return (
    <div>
      <h4 className="mb-1 font-mono text-[9px] uppercase tracking-wider text-lab-text-dim">{title}</h4>
      <div>{events.map((event) => <EventRow key={event.id} event={event} />)}</div>
    </div>
  );
}

function providerHint(providers: EventsProviderDiagnostic[]): string | null {
  const te = providers.find((p) => p.id === "trading-economics");
  const smartLab = providers.find((p) => p.id === "smart-lab");
  if (te?.status === "disabled") return "Trading Economics: ключ не задан";
  if (smartLab?.status === "error") return `Smart-Lab: ${smartLab.error ?? "parser failed"}`;
  if (smartLab?.status === "empty") return "Smart-Lab: календарь пуст";
  const failed = providers.filter((p) => p.enabled && p.status === "error");
  if (failed.length) return failed.map((p) => `${p.id}: ${p.error ?? "error"}`).join(" · ");
  return null;
}

export function ImportantEvents({
  today,
  tomorrow,
  week,
  loaded,
  providers,
  onManualImport,
}: {
  today: PreparationCalendarEvent[];
  tomorrow: PreparationCalendarEvent[];
  week: PreparationCalendarEvent[];
  loaded: boolean;
  providers: EventsProviderDiagnostic[];
  onManualImport?: () => void;
}) {
  const total = today.length + tomorrow.length + week.length;

  if (!loaded) {
    const hint = providerHint(providers);
    return (
      <div className="rounded-md border border-dashed border-white/10 px-3 py-3">
        <p className="font-mono text-[10px] text-rose-300/85">События не загружены</p>
        {hint ? <p className="mt-1 font-mono text-[9px] text-lab-text-dim">{hint}</p> : null}
        {onManualImport ? (
          <button
            type="button"
            onClick={onManualImport}
            className="mt-2 font-mono text-[9px] text-cyan-200/80 underline-offset-2 hover:underline"
          >
            добавить вручную
          </button>
        ) : null}
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="rounded-md border border-dashed border-white/10 px-3 py-3">
        <p className="font-mono text-[10px] text-lab-text-dim">Важных событий нет</p>
        {onManualImport ? (
          <button
            type="button"
            onClick={onManualImport}
            className="mt-2 font-mono text-[9px] text-cyan-200/80 underline-offset-2 hover:underline"
          >
            добавить вручную
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <EventBucket title="Сегодня" events={today} />
      <EventBucket title="Завтра" events={tomorrow} />
      <EventBucket title="Неделя" events={week} />
    </div>
  );
}
