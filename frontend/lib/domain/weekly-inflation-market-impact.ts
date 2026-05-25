import {
  buildWeeklyInflationDashboard,
  INFLATION_REGIME_LABELS,
  type InflationRegime,
  type WeeklyInflationDashboard,
} from "@/lib/domain/weekly-inflation";
import { getLatestInflationBrief } from "@/lib/domain/weekly-inflation-storage";

export type InflationMarketImpactAsset =
  | "ofz"
  | "banks"
  | "rub"
  | "si"
  | "builders"
  | "imoex"
  | "dividend-stocks"
  | "consumer";

export type InflationImpactDirection =
  | "supports-easing"
  | "neutral"
  | "supports-tightness"
  | "shock";

export type InflationMarketImpact = {
  asset: InflationMarketImpactAsset;
  title: string;
  direction: InflationImpactDirection;
  sensitivity: "low" | "medium" | "high";
  explanation: string;
  watchInstruments: string[];
};

export const INFLATION_IMPACT_DIRECTION_LABELS: Record<InflationImpactDirection, string> = {
  "supports-easing": "сценарий смягчения",
  neutral: "нейтрально",
  "supports-tightness": "сценарий ужесточения",
  shock: "шоковый сценарий",
};

export const INFLATION_IMPACT_SENSITIVITY_LABELS: Record<InflationMarketImpact["sensitivity"], string> = {
  low: "низкая",
  medium: "средняя",
  high: "высокая",
};

/** Карточки для UI брифинга — без consumer как отдельной плитки */
export const BRIEFING_MARKET_IMPACT_ASSETS: InflationMarketImpactAsset[] = [
  "ofz",
  "banks",
  "rub",
  "builders",
  "imoex",
  "dividend-stocks",
];

const WATCH_BY_ASSET: Record<InflationMarketImpactAsset, string[]> = {
  ofz: ["RGBI", "OFZ 26238", "OFZ 26247"],
  banks: ["SBER", "VTBR"],
  rub: ["Si", "CNYRUB"],
  si: ["Si", "CNYRUB"],
  builders: ["SMLT", "PIKK", "LSRG"],
  imoex: ["IMOEX", "IMOEXF"],
  "dividend-stocks": ["LKOH", "SBER", "TATN"],
  consumer: ["MGNT", "X5", "FIXP"],
};

function impact(
  asset: InflationMarketImpactAsset,
  title: string,
  direction: InflationImpactDirection,
  sensitivity: InflationMarketImpact["sensitivity"],
  explanation: string,
  watchInstruments?: string[],
): InflationMarketImpact {
  return {
    asset,
    title,
    direction,
    sensitivity,
    explanation,
    watchInstruments: watchInstruments ?? WATCH_BY_ASSET[asset],
  };
}

function buildNoDataImpacts(): InflationMarketImpact[] {
  return BRIEFING_MARKET_IMPACT_ASSETS.map((asset) => {
    const titles: Record<InflationMarketImpactAsset, string> = {
      ofz: "ОФЗ",
      banks: "Банки",
      rub: "Рубль / Si",
      si: "Si",
      builders: "Строители",
      imoex: "Индекс МосБиржи",
      "dividend-stocks": "Дивидендные акции",
      consumer: "Потребительский сектор",
    };
    return impact(
      asset,
      titles[asset],
      "neutral",
      "low",
      "Недельный ряд не загружен — интерпретация недоступна. Добавьте данные в инфляционной лаборатории.",
    );
  });
}

function buildDisinflationImpacts(): InflationMarketImpact[] {
  return [
    impact(
      "ofz",
      "ОФЗ",
      "supports-easing",
      "high",
      "Замедление инфляции поддерживает сценарий более мягкой траектории ставки. Длинные ОФЗ обычно чувствительнее к такому сдвигу ожиданий — без прямого вывода «покупать/продавать».",
    ),
    impact(
      "banks",
      "Банки",
      "supports-easing",
      "medium",
      "Нейтрально-позитивный фон через ожидания ставки: меньше риска экстренного ужесточения. Маржа и качество активов всё равно важнее headline по одной неделе.",
    ),
    impact(
      "rub",
      "Рубль / Si",
      "neutral",
      "medium",
      "Связь не однозначна: дезинфляция может поддерживать рубль через ожидания ставки, но итог зависит от внешнего фона, нефти и ликвидности. Si — индикатор, не сигнал.",
    ),
    impact(
      "builders",
      "Строители",
      "supports-easing",
      "high",
      "Сценарий более мягкой ставки облегчает ипотечный спрос и стоимость финансирования. Смотреть динамику 4w и комментарии по ценам жилья.",
    ),
    impact(
      "imoex",
      "Индекс МосБиржи",
      "supports-easing",
      "medium",
      "Risk-on возможен, если внешний фон и геополитика не мешают. Потребитель и rate-sensitive истории могут выигрывать от более мягких макро-ожиданий.",
    ),
    impact(
      "dividend-stocks",
      "Дивидендные акции",
      "supports-easing",
      "medium",
      "Дивидендная премия часто лучше читается при более мягких ожиданиях по ставке. Важны календарь выплат и sector rotation, не одна неделя CPI.",
    ),
  ];
}

function buildPressureImpacts(): InflationMarketImpact[] {
  return [
    impact(
      "ofz",
      "ОФЗ",
      "supports-tightness",
      "high",
      "Инфляционное давление повышает риск более жёстких комментариев ЦБ. Короткий и средний конец кривой обычно чувствительнее — это контекст duration, не торговый сигнал.",
    ),
    impact(
      "banks",
      "Банки",
      "neutral",
      "medium",
      "Неоднозначно: высокая ставка поддерживает маржу, но ужесточение политики бьёт по качеству активов и спросу на кредит. Смотреть связку ставка + кредитный импульс.",
    ),
    impact(
      "rub",
      "Рубль / Si",
      "neutral",
      "medium",
      "Жёсткая ставка может поддерживать рубль через carry, но импортная инфляция и валютный фон могут давить в другую сторону. Si — для контекста, не для прямого вывода.",
    ),
    impact(
      "builders",
      "Строители",
      "supports-tightness",
      "high",
      "Давление на ипотеку, себестоимость и спрос. Сектор чувствителен к траектории ставки — осторожность в narrative брифинга.",
    ),
    impact(
      "imoex",
      "Индекс МосБиржи",
      "supports-tightness",
      "medium",
      "Осторожность: rate-sensitive и потребительские истории под вопросом; экспортёры могут выглядеть относительно устойчивее на слабом рубле — без универсального вывода по индексу.",
    ),
    impact(
      "dividend-stocks",
      "Дивидендные акции",
      "neutral",
      "medium",
      "Дивидендный дисконт может сужаться при ужесточении, но качество выплат и sector mix важнее одной недели. Контекст, не рекомендация.",
    ),
  ];
}

function buildShockImpacts(): InflationMarketImpact[] {
  return [
    impact(
      "ofz",
      "ОФЗ",
      "shock",
      "high",
      "Сильное инфляционное давление — риск жёстких комментариев ЦБ и пересмотра ожиданий по ставке. Duration-sensitive часть кривой под повышенным вниманием.",
    ),
    impact(
      "banks",
      "Банки",
      "shock",
      "medium",
      "Шок по инфляции повышает неопределённость по траектории ставки и качеству активов. Сектор может реагировать неоднозначно — narrative «осторожно».",
    ),
    impact(
      "rub",
      "Рубль / Si",
      "shock",
      "medium",
      "Высокая volatilily по Si возможна на сочетании инфляционного шока и валютного фона. Прямой знак не фиксируем — смотреть импорт и ликвидность.",
    ),
    impact(
      "builders",
      "Строители",
      "shock",
      "high",
      "Один из наиболее чувствительных секторов к инфляционному шоку и риску ужесточения. Ипотека и маржа застройщиков — ключевой контекст для эфира.",
    ),
    impact(
      "imoex",
      "Индекс МосБиржи",
      "shock",
      "medium",
      "Осторожность по широкому рынку: rate-sensitive сектора под давлением. Экспортёры и commodity-linked могут вести себя иначе — без единого сценария по IMOEX.",
    ),
    impact(
      "dividend-stocks",
      "Дивидендные акции",
      "supports-tightness",
      "medium",
      "При шоке рынок часто пересматривает дисконт и dividend sustainability. Смотреть LKOH/SBER/TATN как якоря ликвидности, не как «идеи сделки».",
    ),
  ];
}

function buildNeutralImpacts(): InflationMarketImpact[] {
  return [
    impact(
      "ofz",
      "ОФЗ",
      "neutral",
      "medium",
      "Инфляция вблизи цели — кривая в диапазоне. Смотреть surprise по неделе и формулировки ЦБ, а не только headline.",
    ),
    impact(
      "banks",
      "Банки",
      "neutral",
      "low",
      "Баланс без явного перекоса: ставка и кредитный цикл важнее одной недели.",
    ),
    impact(
      "rub",
      "Рубль / Si",
      "neutral",
      "medium",
      "Нейтральный макро-фон по инфляции — Si движется скорее от валютного и внешнего контекста.",
    ),
    impact(
      "builders",
      "Строители",
      "neutral",
      "medium",
      "Смешанный фон: ставка и цены жилья важнее одной недели CPI.",
    ),
    impact(
      "imoex",
      "Индекс МосБиржи",
      "neutral",
      "low",
      "IMOEX без явного инфляционного перекоса — sector rotation и внешний фон первичны.",
    ),
    impact(
      "dividend-stocks",
      "Дивидендные акции",
      "neutral",
      "low",
      "Дивидендный narrative без сильного макро-сдвига — календарь выплат и sector flows.",
    ),
  ];
}

export function buildInflationMarketImpacts(regime: InflationRegime): InflationMarketImpact[] {
  switch (regime) {
    case "disinflation":
      return buildDisinflationImpacts();
    case "pressure":
      return buildPressureImpacts();
    case "shock":
      return buildShockImpacts();
    case "no-data":
      return buildNoDataImpacts();
    default:
      return buildNeutralImpacts();
  }
}

export function buildInflationMarketImpactBrief(dashboard: WeeklyInflationDashboard): {
  regime: InflationRegime;
  regimeLabel: string;
  impacts: InflationMarketImpact[];
} {
  const regime = dashboard.metrics.regime;
  return {
    regime,
    regimeLabel: INFLATION_REGIME_LABELS[regime],
    impacts: buildInflationMarketImpacts(regime),
  };
}

export function readWeeklyInflationBriefFromStorage(): {
  hasData: boolean;
  headlineLabel: string;
  regimeLabel: string;
  periodLabel: string | null;
} {
  const brief = getLatestInflationBrief();
  return {
    hasData: brief.hasData,
    headlineLabel: brief.headlineLabel,
    regimeLabel: brief.regimeLabel,
    periodLabel: brief.periodLabel,
  };
}
