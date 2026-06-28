import type { ScreenerApiResponse, ScreenerDataStatus } from "@screenerpro/shared";

export type ScreenerEmptyState = {
  title: string;
  text: string;
};

export function resolveScreenerEmptyState(input: {
  isLoading: boolean;
  error: boolean;
  status?: ScreenerDataStatus | null;
  diagnostics?: ScreenerApiResponse["diagnostics"];
  visibleCount: number;
  apiRowCount: number;
  hideIlliquid?: boolean;
  historicalEmpty?: boolean;
}): ScreenerEmptyState | null {
  if (input.isLoading) {
    return {
      title: "Загрузка…",
      text: input.historicalEmpty ? "Загружаем историю MOEX ISS" : "Подключаемся к MOEX ISS",
    };
  }

  if (input.historicalEmpty) {
    return {
      title: "Нет данных за дату",
      text: input.status?.message ?? "MOEX не вернул историю за выбранный день",
    };
  }

  if (input.apiRowCount > 0 && input.visibleCount === 0 && input.hideIlliquid) {
    return {
      title: "Фильтр скрыл все строки",
      text: "Ослабьте «Скрыть неликвиды» — в API есть бумаги, но они не проходят порог ликвидности",
    };
  }

  if (input.apiRowCount === 0) {
    if (input.status?.source === "off" || input.status?.fallbackReason === "data-disabled") {
      return {
        title: "Данные отключены",
        text: input.status?.message ?? "MOEX_DATA_MODE=off — включите live или fallback в .env",
      };
    }
    if (input.status?.isDemo || input.status?.source === "fallback" || input.status?.source === "demo") {
      return {
        title: "DEMO · нет live-данных",
        text:
          (input.diagnostics?.errors?.[0] ?? input.status.message) ||
          "MOEX недоступен — показан учебный набор. Проверьте сеть или VPN к iss.moex.com",
      };
    }
    if (input.status?.staleCache) {
      return {
        title: "Кэш MOEX",
        text: input.status.message ?? "Показан последний успешный снимок",
      };
    }
    if (input.status?.marketStatus === "closed") {
      return {
        title: "Рынок закрыт",
        text: "Сессия не активна — live-строки могут отсутствовать",
      };
    }
    const reason = input.status?.emptyReason ?? input.diagnostics?.fallbackReason ?? input.status?.fallbackReason;
    const diagRows = input.diagnostics?.rowsRaw;
    const diagHint =
      typeof diagRows === "number"
        ? ` До фильтров API: ${diagRows} строк.`
        : "";
    return {
      title: "Данных нет",
      text:
        reason === "no-usable-rows"
          ? `MOEX не отдал строки с ценой или оборотом.${diagHint}`
          : reason === "validation-failed"
            ? "Ответ MOEX не прошёл проверку"
            : reason === "moex-unavailable"
              ? `${input.status?.message ?? "MOEX ISS недоступен"}${diagHint} Повторите или откройте /api/screener/health`
              : input.status?.message ?? `Источник не вернул инструменты.${diagHint}`,
    };
  }

  if (input.error) {
    return {
      title: "Данные временно недоступны",
      text: "Повторите через минуту или откройте /api/screener/health",
    };
  }

  return null;
}
