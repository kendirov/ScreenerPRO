"use client";

import { Trash2 } from "lucide-react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import {
  buildRecentWeeksTableRows,
  formatInflationPct,
  formatPeriodLabel,
  WEEKLY_INFLATION_SOURCE_LABELS,
  type WeeklyInflationOfficialPublication,
  type WeeklyInflationPoint,
} from "@/lib/domain/weekly-inflation";
import { cn } from "@/lib/utils/cn";

export function InflationRecentWeeksTable({
  points,
  officialPublication,
  onDeleteWeek,
  className,
}: {
  points: WeeklyInflationPoint[];
  officialPublication: WeeklyInflationOfficialPublication | null;
  onDeleteWeek: (periodEnd: string) => void;
  className?: string;
}) {
  const rows = buildRecentWeeksTableRows(points, officialPublication, 10);

  if (rows.length === 0) {
    return (
      <section className={cn("lab-glass-panel p-4", className)}>
        <LabSectionHeading>Последние недели</LabSectionHeading>
        <p className="text-[11px] text-lab-muted">Таблица появится после загрузки первой недели.</p>
      </section>
    );
  }

  return (
    <section className={cn("lab-glass-panel overflow-hidden p-4", className)}>
      <LabSectionHeading>Последние недели</LabSectionHeading>
      <p className="mb-3 text-[11px] text-lab-muted">Компактный список — до 10 последних недель.</p>

      <div className="overflow-x-auto rounded-xl border border-lab-border/80">
        <table className="w-full min-w-[640px] text-left text-[11px]">
          <thead className="bg-lab-bg-deep/50 text-lab-dim">
            <tr>
              <th className="px-2 py-2 font-medium">Период</th>
              <th className="px-2 py-2 font-medium">Неделя %</th>
              <th className="px-2 py-2 font-medium">4w avg</th>
              <th className="px-2 py-2 font-medium">Annualized</th>
              <th className="px-2 py-2 font-medium">Источник</th>
              <th className="px-2 py-2 font-medium">Проверка</th>
              <th className="px-2 py-2 font-medium" aria-label="Удалить" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.point.periodEnd} className="border-t border-lab-border/60">
                <td className="px-2 py-2 text-lab-text">{formatPeriodLabel(row.point) ?? row.point.periodEnd}</td>
                <td className="px-2 py-2 tabular-nums text-lab-text">
                  {formatInflationPct(row.point.headlinePct)}
                </td>
                <td className="px-2 py-2 tabular-nums text-lab-muted">
                  {row.avg4w != null ? formatInflationPct(row.avg4w) : "—"}
                </td>
                <td className="px-2 py-2 tabular-nums text-lab-muted">
                  {row.annualized != null ? formatInflationPct(row.annualized) : "—"}
                </td>
                <td className="px-2 py-2 text-lab-muted">
                  {WEEKLY_INFLATION_SOURCE_LABELS[row.point.source]}
                </td>
                <td className="px-2 py-2">
                  <VerificationChip label={row.verificationLabel} />
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onDeleteWeek(row.point.periodEnd)}
                    className="inline-flex items-center rounded-md border border-lab-red/25 p-1 text-lab-red/80 hover:bg-lab-red/5"
                    aria-label={`Удалить неделю ${row.point.periodEnd}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VerificationChip({ label }: { label: string }) {
  const tone =
    label === "проверено"
      ? "border-lab-cyan/30 bg-lab-cyan/10 text-lab-cyan"
      : label === "есть URL"
        ? "border-lab-violet/30 bg-lab-violet/10 text-lab-violet"
        : "border-lab-border text-lab-muted";

  return <span className={cn("inline-flex rounded-md border px-1.5 py-0.5 text-[10px]", tone)}>{label}</span>;
}
