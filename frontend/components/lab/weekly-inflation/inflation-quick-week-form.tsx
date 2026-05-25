"use client";

import * as React from "react";
import { PlusCircle } from "lucide-react";
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
}: {
  points: WeeklyInflationPoint[];
  onPointsChange: (points: WeeklyInflationPoint[]) => void;
  className?: string;
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
    <form
      onSubmit={handleSubmit}
      className={cn("lab-glass-panel flex h-full flex-col p-4", className)}
    >
      <p className="text-sm font-medium text-lab-text">Быстрый ввод недели</p>
      <p className="mt-1 text-[11px] text-lab-muted">
        После публикации Росстата — одна строка без CSV.
      </p>

      <div className="mt-3 grid flex-1 gap-2 sm:grid-cols-2">
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
        <Field label="Ссылка на источник" className="sm:col-span-2">
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
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-lab-violet/30 bg-lab-violet/10 px-3 py-1.5 text-sm text-lab-text hover:bg-lab-violet/15"
      >
        <PlusCircle className="h-4 w-4" />
        Добавить
      </button>
    </form>
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
