"use client";

import * as React from "react";
import { ClipboardPaste, PlusCircle } from "lucide-react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import {
  EVENT_CATEGORY_LABELS,
  EVENT_IMPACT_LABELS,
  type PreparationEvent,
} from "@/lib/domain/preparation-events";
import {
  createDefaultManualEventForm,
  createUnparsedEventNote,
  manualFormToPreparationEvent,
  validateManualEventForm,
  type ManualEventFormValues,
  type UnparsedEventNote,
} from "@/lib/domain/preparation-manual-import";
import { MANUAL_IMPORT_SOURCE_OPTIONS } from "@/lib/domain/preparation-sources";
import { cn } from "@/lib/utils/cn";

const CATEGORY_KEYS = Object.keys(EVENT_CATEGORY_LABELS) as ManualEventFormValues["category"][];
const IMPACT_KEYS = Object.keys(EVENT_IMPACT_LABELS) as ManualEventFormValues["impact"][];

export function ManualEventImport({
  onAddEvent,
  unparsedNotes,
  onAddUnparsedNote,
  onRemoveUnparsedNote,
  className,
}: {
  onAddEvent: (event: PreparationEvent) => void;
  unparsedNotes: UnparsedEventNote[];
  onAddUnparsedNote: (note: UnparsedEventNote) => void;
  onRemoveUnparsedNote: (id: string) => void;
  className?: string;
}) {
  const [form, setForm] = React.useState<ManualEventFormValues>(() => createDefaultManualEventForm());
  const [pasteText, setPasteText] = React.useState("");
  const [pasteSourceId, setPasteSourceId] = React.useState("markettwits");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);

  const updateField = <K extends keyof ManualEventFormValues>(key: K, value: ManualEventFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError(null);
    setFormSuccess(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const error = validateManualEventForm(form);
    if (error) {
      setFormError(error);
      return;
    }
    const prepared = manualFormToPreparationEvent(form);
    onAddEvent(prepared);
    setForm(createDefaultManualEventForm());
    setFormSuccess(`«${prepared.title}» добавлено в календарь.`);
    window.setTimeout(() => setFormSuccess(null), 3000);
  };

  const handlePasteSave = () => {
    const text = pasteText.trim();
    if (!text) return;
    onAddUnparsedNote(createUnparsedEventNote(text, pasteSourceId));
    setPasteText("");
  };

  return (
    <section className={cn("lab-glass-panel relative overflow-hidden p-3", className)}>
      <LabSectionHeading className="mb-1 flex items-center gap-1.5 text-lab-violet/90">
        <PlusCircle className="h-3.5 w-3.5" />
        Ручной импорт событий
      </LabSectionHeading>
      <p className="text-[11px] text-lab-muted">
        Форма или вставка списка — данные только в этой сессии браузера, без backend.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Дата">
            <input
              type="date"
              value={form.date}
              onChange={(e) => updateField("date", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Время МСК">
            <input
              type="text"
              placeholder="13:30"
              value={form.timeMsk}
              onChange={(e) => updateField("timeMsk", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Название события">
          <input
            type="text"
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            className={inputClass}
            placeholder="Решение ЦБ по ставке"
          />
        </Field>

        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Категория">
            <select
              value={form.category}
              onChange={(e) => updateField("category", e.target.value as ManualEventFormValues["category"])}
              className={inputClass}
            >
              {CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {EVENT_CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Важность">
            <select
              value={form.impact}
              onChange={(e) => updateField("impact", e.target.value as ManualEventFormValues["impact"])}
              className={inputClass}
            >
              {IMPACT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {EVENT_IMPACT_LABELS[key]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Источник">
          <select
            value={form.sourceId}
            onChange={(e) => updateField("sourceId", e.target.value)}
            className={inputClass}
          >
            {MANUAL_IMPORT_SOURCE_OPTIONS.map((source) => (
              <option key={source.id} value={source.id}>
                {source.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Затрагивает инструменты">
          <input
            type="text"
            value={form.affectedInstruments}
            onChange={(e) => updateField("affectedInstruments", e.target.value)}
            className={inputClass}
            placeholder="SBER, Si, BR — через запятую"
          />
        </Field>

        <Field label="Ожидание рынка">
          <textarea
            value={form.expectation}
            onChange={(e) => updateField("expectation", e.target.value)}
            className={cn(inputClass, "min-h-[52px] resize-y")}
            rows={2}
          />
        </Field>

        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Сценарий выше ожиданий">
            <textarea
              value={form.scenarioAbove}
              onChange={(e) => updateField("scenarioAbove", e.target.value)}
              className={cn(inputClass, "min-h-[52px] resize-y")}
              rows={2}
            />
          </Field>
          <Field label="Сценарий ниже ожиданий">
            <textarea
              value={form.scenarioBelow}
              onChange={(e) => updateField("scenarioBelow", e.target.value)}
              className={cn(inputClass, "min-h-[52px] resize-y")}
              rows={2}
            />
          </Field>
        </div>

        <Field label="Заметка">
          <textarea
            value={form.note}
            onChange={(e) => updateField("note", e.target.value)}
            className={cn(inputClass, "min-h-[44px] resize-y")}
            rows={2}
          />
        </Field>

        {formError ? <p className="text-[11px] text-lab-red">{formError}</p> : null}
        {formSuccess ? <p className="text-[11px] text-lab-green">{formSuccess}</p> : null}

        <button
          type="submit"
          className="w-full rounded-md border border-lab-violet/35 bg-lab-violet/10 px-3 py-2 text-sm font-medium text-lab-violet transition hover:shadow-[var(--lab-glow-violet)]"
        >
          Добавить в календарь
        </button>
      </form>

      <div className="mt-4 border-t border-lab-border/60 pt-4">
        <LabSectionHeading className="mb-2 flex items-center gap-1.5 text-lab-amber/90">
          <ClipboardPaste className="h-3.5 w-3.5" />
          Вставить список событий
        </LabSectionHeading>
        <p className="mb-2 text-[10px] text-lab-dim">
          Скопируйте текст из MarketTwits, БКС, Финам — парсер позже; сейчас сохраняем как есть.
        </p>

        <select
          value={pasteSourceId}
          onChange={(e) => setPasteSourceId(e.target.value)}
          className={cn(inputClass, "mb-2")}
        >
          {MANUAL_IMPORT_SOURCE_OPTIONS.map((source) => (
            <option key={source.id} value={source.id}>
              {source.title}
            </option>
          ))}
        </select>

        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="09:00 — CPI США&#10;13:30 — Ставка ЦБ&#10;..."
          className={cn(inputClass, "min-h-[100px] resize-y font-mono text-[11px]")}
          rows={5}
        />

        <button
          type="button"
          onClick={handlePasteSave}
          disabled={!pasteText.trim()}
          className="mt-2 w-full rounded-md border border-lab-amber/35 bg-lab-amber/10 px-3 py-2 text-sm text-lab-amber transition hover:shadow-[var(--lab-glow-amber)] disabled:opacity-40"
        >
          Сохранить как неразобранные
        </button>
      </div>

      {unparsedNotes.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-medium text-lab-amber/90">Неразобранные события</p>
          {unparsedNotes.map((note) => (
            <div
              key={note.id}
              className="lab-glass-card border border-dashed border-lab-amber/30 bg-lab-amber/5 px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="lab-status-chip lab-chip-dev px-1.5 py-px text-[9px]">
                  {note.sourceLabel}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveUnparsedNote(note.id)}
                  className="text-[10px] text-lab-dim hover:text-lab-red"
                >
                  Удалить
                </button>
              </div>
              <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-lab-muted">
                {note.rawText}
              </pre>
              <p className="mt-1 text-[9px] text-lab-dim">
                Парсер не подключён — разберите вручную через форму выше.
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-lab-dim">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-lab-border/70 bg-lab-bg-deep/80 px-2.5 py-1.5 text-[12px] text-lab-text outline-none transition focus:border-lab-cyan/40 focus:ring-1 focus:ring-lab-cyan/20";
