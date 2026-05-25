"use client";

import * as React from "react";
import { PlusCircle } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import {
  createDefaultQuickWeekForm,
  mergeWeeklyInflationPoints,
  quickFormToPoint,
  type QuickWeekFormValues,
  type WeeklyInflationPoint,
} from "@/lib/domain/weekly-inflation";
import { cn } from "@/lib/utils/cn";

const inputClass =
  "w-full rounded-lg border border-lab-border bg-lab-bg-deep/60 px-2.5 py-1.5 text-sm text-lab-text outline-none focus:border-lab-violet/40";

export function InflationQuickWeekForm({
  points,
  onPointsChange,
  className,
  formRef,
}: {
  points: WeeklyInflationPoint[];
  onPointsChange: (points: WeeklyInflationPoint[]) => void;
  className?: string;
  formRef?: React.RefObject<HTMLFormElement | null>;
}) {
  const [form, setForm] = React.useState<QuickWeekFormValues>(() => createDefaultQuickWeekForm());
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const updateField = <K extends keyof QuickWeekFormValues>(key: K, value: QuickWeekFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const point = quickFormToPoint(form);
      onPointsChange(mergeWeeklyInflationPoints(points, [point]));
      setForm(createDefaultQuickWeekForm());
      setSuccess(`Неделя ${point.periodStart} — ${point.periodEnd} добавлена.`);
      window.setTimeout(() => setSuccess(null), 3500);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось добавить неделю.");
    }
  };

  return (
    <LabGlassPanel depth={20} variant="strong" className={cn("p-4", className)}>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-lab-text">Добавить последнюю неделю</p>
        <p className="mt-1 text-[11px] text-lab-muted">
          После публикации Росстата — одна строка без CSV. KPI, графики и брифинг обновятся сразу.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Период с">
          <input
            type="date"
            value={form.periodStart}
            onChange={(e) => updateField("periodStart", e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Период по">
          <input
            type="date"
            value={form.periodEnd}
            onChange={(e) => updateField("periodEnd", e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Недельная инфляция, %">
          <input
            type="text"
            inputMode="decimal"
            value={form.headlinePct}
            onChange={(e) => updateField("headlinePct", e.target.value)}
            placeholder="0.11"
            className={inputClass}
            required
          />
        </Field>
        <Field label="С начала года, %">
          <input
            type="text"
            inputMode="decimal"
            value={form.ytdPct}
            onChange={(e) => updateField("ytdPct", e.target.value)}
            placeholder="3.45"
            className={inputClass}
          />
        </Field>
        <Field label="Ссылка на источник" className="lg:col-span-2">
          <input
            type="url"
            value={form.sourceUrl}
            onChange={(e) => updateField("sourceUrl", e.target.value)}
            placeholder="https://rosstat.gov.ru/..."
            className={inputClass}
          />
        </Field>
      </div>

      {error ? <p className="mt-2 text-sm text-lab-red">{error}</p> : null}
      {success ? <p className="mt-2 text-sm text-lab-cyan">{success}</p> : null}

      <button
        type="submit"
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-lab-cyan/35 bg-lab-cyan/12 px-4 py-2 text-sm text-lab-text shadow-[var(--lab-glow-cyan)] transition-colors hover:bg-lab-cyan/18"
      >
        <PlusCircle className="h-4 w-4" />
        Добавить
      </button>
      </form>
    </LabGlassPanel>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-[10px] uppercase tracking-[0.1em] text-lab-dim">{label}</span>
      {children}
    </label>
  );
}
