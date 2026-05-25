export type SessionPulseInfo = {
  moscowTime: string;
  phase: string;
  nextEvent: string;
  href: string;
  available: boolean;
};

/** Фазы торгов MOEX (упрощённо, МСК). */
export function getSessionPulseInfo(now = new Date()): SessionPulseInfo {
  const moscowTime = now.toLocaleTimeString("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const mins = hour * 60 + minute;

  let phase: string;
  let nextEvent: string;

  if (mins < 10 * 60) {
    phase = "До открытия";
    nextEvent = "Открытие основной сессии · 10:00";
  } else if (mins < 18 * 60 + 45) {
    phase = "Основная сессия";
    nextEvent = "Клиринг · 18:45";
  } else if (mins < 19 * 60 + 5) {
    phase = "Клиринг";
    nextEvent = "Вечерняя сессия · 19:05";
  } else if (mins < 23 * 60 + 50) {
    phase = "Вечерняя сессия";
    nextEvent = "Закрытие · 23:50";
  } else {
    phase = "Закрыто";
    nextEvent = "Открытие · 10:00";
  }

  return {
    moscowTime,
    phase,
    nextEvent,
    href: "/lab/session-liquidity-map",
    available: false,
  };
}
