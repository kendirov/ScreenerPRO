export type EducationalLevelId = "take" | "entry" | "stop" | "liquidation";

export const LIQUIDATION_MAP_TAKEAWAY =
  "Стоп — твой контроль. Ликвидация — контроль биржи.";

export const BUFFER_ZONE_LABEL = "Запас между стопом и ликвидацией";

/** Заголовок Price Ladder над графиком (aria). */
export const LADDER_CHART_HEADLINE_LONG =
  "Long: цена вниз → стоп → ликвидация. Цена вверх → цель.";

export const LADDER_CHART_HEADLINE_SHORT =
  "Short: цена вверх → стоп → ликвидация. Цена вниз → цель.";

/** Подсказка в панели управления. */
export const DIRECTION_FLOW_LONG =
  "Цена вниз → стоп → ликвидация. Цена вверх → цель.";

export const DIRECTION_FLOW_SHORT =
  "Цена вверх → стоп → ликвидация. Цена вниз → цель.";

export const LADDER_ZONE_LABELS = {
  profit: "Зона прибыли",
  controlled: "Контролируемый риск",
  danger_buffer: "Запас до ликвидации",
  liquidation: "Зона ликвидации",
} as const;

export const LADDER_LEVEL_LABELS: Record<
  EducationalLevelId,
  { title: string; tagline: string; hint: string }
> = {
  entry: {
    title: "Вход",
    tagline: "Entry",
    hint: "точка отсчёта",
  },
  take: {
    title: "Цель",
    tagline: "Take Profit",
    hint: "плановая фиксация прибыли",
  },
  stop: {
    title: "Стоп",
    tagline: "Stop-loss",
    hint: "твой плановый выход из ошибки",
  },
  liquidation: {
    title: "Ликвидация",
    tagline: "Liquidation",
    hint: "принудительное закрытие биржей",
  },
};

/** Подсказки при наведении на линии Price Ladder. */
export const LADDER_LINE_TOOLTIPS: Record<EducationalLevelId, string> = {
  entry: "Цена входа. От неё считаются PnL, стоп и ликвидация.",
  stop: "Твой плановый выход из ошибки.",
  liquidation: "Принудительное закрытие биржей.",
  take: "Плановая фиксация прибыли.",
};
