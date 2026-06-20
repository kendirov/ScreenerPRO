/** Trading-day window for CBR rate-reaction charts (MSK). */

export const CBR_SESSION_START_MSK = "10:00";
export const CBR_SESSION_END_MSK = "19:00";

export type CbrEventWindow = {
  date: string;
  startMsk: string;
  endMsk: string;
  startUnix: number;
  endUnix: number;
  timezone: "Europe/Moscow";
};

/** Minutes from 10:00 MSK for chart phase logic */
export function minutesFromSessionOpen(dateIso: string, hhmm: string): number {
  const unix = mskTimeToUnix(dateIso, hhmm);
  const open = mskTimeToUnix(dateIso, CBR_SESSION_START_MSK);
  return Math.round((unix - open) / 60);
}

export function mskTimeToUnix(dateIso: string, hhmm: string): number {
  const [h, m] = hhmm.split(":").map((v) => Number(v));
  const iso = `${dateIso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+03:00`;
  return Math.floor(new Date(iso).getTime() / 1000);
}

export function getEventWindow(dateIso: string): CbrEventWindow {
  return {
    date: dateIso,
    startMsk: CBR_SESSION_START_MSK,
    endMsk: CBR_SESSION_END_MSK,
    startUnix: mskTimeToUnix(dateIso, CBR_SESSION_START_MSK),
    endUnix: mskTimeToUnix(dateIso, CBR_SESSION_END_MSK),
    timezone: "Europe/Moscow",
  };
}

export function formatMskTimeLabel(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  });
}
