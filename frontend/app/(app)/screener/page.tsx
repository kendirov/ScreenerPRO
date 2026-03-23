import { ScreenerTable } from "@/components/screener/screener-table";
import { SectionHeader } from "@/components/ui/primitives";
import { screenerRows } from "@/lib/mock/screener";
import type { ScreenerRow } from "@/lib/types/market";
import { getScreenerDiagnostics, getScreenerRows } from "@/lib/server/services/screener-query";

type DataSourceStatus = {
  source: "moex" | "demo";
  reason?: "db-empty" | "not-initialized" | "api-error" | "ingest-running";
  rowCount: number;
};

async function getRows(): Promise<{ rows: ScreenerRow[]; status: DataSourceStatus }> {
  try {
    const [rows, diagnostics] = await Promise.all([getScreenerRows("all"), getScreenerDiagnostics()]);
    if (rows.length > 0) {
      return {
        rows,
        status: {
          source: "moex",
          reason: diagnostics.ingestInProgress ? "ingest-running" : undefined,
          rowCount: rows.length,
        },
      };
    }
    const reason = diagnostics.databaseConfigured ? "db-empty" : "not-initialized";
    return { rows: screenerRows, status: { source: "demo", reason, rowCount: screenerRows.length } };
  } catch {
    return { rows: screenerRows, status: { source: "demo", reason: "api-error", rowCount: screenerRows.length } };
  }
}

export default async function ScreenerPage() {
  const { rows, status } = await getRows();
  const reasonText =
    status.reason === "db-empty"
      ? "База данных пуста"
      : status.reason === "not-initialized"
        ? "Инициализация не выполнена"
    : status.reason === "ingest-running"
      ? "Идёт обновление данных"
        : status.reason === "api-error"
          ? "Ошибка загрузки API"
          : null;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Скринер рынка"
        subtitle="Отслеживание акций и фьючерсов MOEX в едином интерфейсе."
      />
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-400">Источник данных:</span>
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">
            {status.source === "moex" ? "MOEX" : "демо-данные"}
          </span>
          <span className={status.source === "moex" ? "text-emerald-300" : "text-amber-300"}>
            {status.source === "moex" ? (status.reason === "ingest-running" ? "Идёт обновление данных" : "Реальные данные активны") : "Активен демо-режим"}
          </span>
          {reasonText ? <span className="text-amber-300">{reasonText}</span> : <span className="text-emerald-300">Данные загружены</span>}
          <span className="text-slate-500">Строк: {status.rowCount}</span>
          {reasonText ? (
            <a
              href="/api/admin/ingest/moex"
              className="ml-auto rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-cyan-400 hover:text-cyan-200"
            >
              Запустить инициализацию
            </a>
          ) : null}
        </div>
      </div>
      <ScreenerTable rows={rows} />
    </div>
  );
}
