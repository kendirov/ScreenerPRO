"use client";

import * as React from "react";
import { Download, Upload } from "lucide-react";
import {
  downloadWeeklyInflationCsvTemplate,
  mergeWeeklyInflationPoints,
  parseWeeklyInflationCsv,
  WEEKLY_INFLATION_CSV_COLUMNS,
  WEEKLY_INFLATION_CSV_FORMAT_EXAMPLE,
  type WeeklyInflationPoint,
} from "@/lib/domain/weekly-inflation";
import { cn } from "@/lib/utils/cn";

export function InflationManualImport({
  points,
  onPointsChange,
  onClear,
  className,
  embedded = false,
  csvSectionRef,
}: {
  points: WeeklyInflationPoint[];
  onPointsChange: (points: WeeklyInflationPoint[]) => void;
  onClear: () => void;
  className?: string;
  embedded?: boolean;
  csvSectionRef?: React.RefObject<HTMLElement | null>;
}) {
  const [pasteText, setPasteText] = React.useState("");
  const [csvError, setCsvError] = React.useState<string | null>(null);
  const [csvSuccess, setCsvSuccess] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const importCsvText = (text: string) => {
    const result = parseWeeklyInflationCsv(text);
    if (!result.ok) {
      setCsvError(result.error);
      setCsvSuccess(null);
      return;
    }
    onPointsChange(mergeWeeklyInflationPoints(points, result.points));
    setCsvError(null);
    setCsvSuccess(`Загружено ${result.points.length} нед.`);
    setPasteText("");
    window.setTimeout(() => setCsvSuccess(null), 3500);
  };

  const handleImportCsv = () => importCsvText(pasteText);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Нужен файл .csv");
      return;
    }
    try {
      const text = await file.text();
      importCsvText(text);
    } catch {
      setCsvError("Не удалось прочитать файл.");
    }
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  return (
    <section
      ref={csvSectionRef as React.RefObject<HTMLElement>}
      id="weekly-inflation-csv-import"
      className={cn(embedded ? "space-y-4" : "lab-glass-panel relative overflow-hidden p-4", className)}
    >
      {embedded ? (
        <p className="text-[11px] text-lab-muted">Полный импорт CSV · drag/drop · localStorage</p>
      ) : null}

      <div>
        <p className="text-xs font-medium text-lab-text">Импорт CSV</p>
        <p className="mt-1 text-[11px] text-lab-muted">
          Формат: <code className="rounded bg-lab-bg-deep px-1 py-0.5 text-[10px]">{WEEKLY_INFLATION_CSV_COLUMNS}</code>
        </p>
        <p className="mt-1 text-[10px] text-lab-amber/90">Это пример формата, не реальные данные.</p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={cn(
            "mt-2 rounded-xl border border-dashed px-3 py-4 transition-colors",
            dragActive ? "border-lab-violet/50 bg-lab-violet/10" : "border-lab-border bg-lab-bg-deep/30",
          )}
        >
          <textarea
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setCsvError(null);
            }}
            rows={5}
            placeholder={WEEKLY_INFLATION_CSV_FORMAT_EXAMPLE}
            className="w-full rounded-lg border border-lab-border bg-lab-bg-deep/60 px-3 py-2 font-mono text-[11px] text-lab-text outline-none focus:border-lab-violet/40"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[11px] text-lab-muted hover:text-lab-text">
              или перетащите .csv сюда
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>
        </div>

        {csvError ? <p className="mt-2 text-sm text-lab-red">{csvError}</p> : null}
        {csvSuccess ? <p className="mt-2 text-sm text-lab-cyan">{csvSuccess}</p> : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleImportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-lab-violet/30 bg-lab-violet/10 px-3 py-1.5 text-sm text-lab-text hover:bg-lab-violet/15"
          >
            <Upload className="h-4 w-4" />
            Загрузить CSV
          </button>
          <button
            type="button"
            onClick={downloadWeeklyInflationCsvTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-lab-border px-3 py-1.5 text-sm text-lab-muted hover:text-lab-text"
          >
            <Download className="h-4 w-4" />
            Скачать шаблон CSV
          </button>
          {points.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 rounded-lg border border-lab-red/30 px-3 py-1.5 text-sm text-lab-red/90 hover:bg-lab-red/5"
            >
              Очистить данные
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
