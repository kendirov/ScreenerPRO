/**
 * Состав индекса IMOEX (secids).
 * Источник: MOEX ISS analytics, обновлять при ребалансе.
 * https://iss.moex.com/iss/statistics/engines/stock/markets/index/analytics/IMOEX.json
 * Снимок: 2026-06-23, 46 компонентов.
 */
export const IMOEX_COMPONENTS = [
  "AFKS",
  "AFLT",
  "ALRS",
  "BSPB",
  "CBOM",
  "CHMF",
  "CNRU",
  "DOMRF",
  "ENPG",
  "FLOT",
  "GAZP",
  "GMKN",
  "HEAD",
  "IRAO",
  "LENT",
  "LKOH",
  "MAGN",
  "MDMG",
  "MOEX",
  "MSNG",
  "MTSS",
  "NLMK",
  "NVTK",
  "OZON",
  "PHOR",
  "PLZL",
  "POSI",
  "RAGR",
  "RENI",
  "ROSN",
  "RTKM",
  "RUAL",
  "SBER",
  "SBERP",
  "SNGS",
  "SNGSP",
  "SVCB",
  "T",
  "TATN",
  "TATNP",
  "TRNFP",
  "UGLD",
  "VKCO",
  "VTBR",
  "X5",
  "YDEX",
] as const;

export type ImoexComponentTicker = (typeof IMOEX_COMPONENTS)[number];

export const IMOEX_COMPONENTS_SET = new Set<string>(IMOEX_COMPONENTS);

export const IMOEX_COMPONENTS_SOURCE = "static" as const;

export const IMOEX_COMPONENTS_ISS_URL =
  "https://iss.moex.com/iss/statistics/engines/stock/markets/index/analytics/IMOEX.json";
