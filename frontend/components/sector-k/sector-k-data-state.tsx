import type { ScreenerDataStatus } from "@screenerpro/shared";

function formatMsk(value: string | null | undefined): string {
  if (!value) return "время не получено";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "время не получено";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date) + " МСК";
}

export function SectorKSource({ status, error }: { status?: ScreenerDataStatus; error?: Error | null }) {
  const state = error ? "is-error" : status?.degraded ? "is-degraded" : status?.source === "moex" ? "is-live" : "";
  const label = error
    ? "источник недоступен"
    : status
      ? `${status.source === "moex" ? "MOEX ISS" : status.source} · ${formatMsk(status.sourceTimestamp ?? status.fetchTimestamp)}`
      : "подключение к MOEX ISS";
  return (
    <span className={`sk-source ${state}`} title={status?.message ?? undefined}>
      <span className="sk-source__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export function SectorKDataError({ error }: { error: Error }) {
  return <div className="sk-error" role="alert">Данные рынка не получены: {error.message}. Интерфейс не подменяет их демо-значениями.</div>;
}

export function SectorKLoading({ label = "Получаем снимок рынка…" }: { label?: string }) {
  return <div className="sk-empty" aria-live="polite"><div><span className="sk-source"><span className="sk-source__dot" />MOEX ISS</span><p>{label}</p></div></div>;
}
