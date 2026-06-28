import type { PreparationCalendarEvent } from "@/lib/preparation/preparation-types";

function moscowDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(now);
}

function addDaysIso(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function bucketCalendarEvents(
  events: PreparationCalendarEvent[],
  reference = new Date(),
): { today: PreparationCalendarEvent[]; tomorrow: PreparationCalendarEvent[]; week: PreparationCalendarEvent[] } {
  const today = moscowDateKey(reference);
  const tomorrow = addDaysIso(today, 1);
  const weekEnd = addDaysIso(today, 7);

  return {
    today: events.filter((e) => e.date === today),
    tomorrow: events.filter((e) => e.date === tomorrow),
    week: events.filter((e) => e.date > tomorrow && e.date <= weekEnd),
  };
}
