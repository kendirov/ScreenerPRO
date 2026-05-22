import { formatLots, type DomLevelTooltipData } from "@/lib/domain/order-book-ladder-model";
import { formatPrice } from "@/lib/formatters/number";

export function buildLevelInspectorLesson(data: DomLevelTooltipData): string {
  const price = formatPrice(data.price);
  const sideLabel = data.side === "ask" ? "ask" : "bid";
  const vol = data.volume > 0 ? formatLots(data.volume) : "пусто";

  if (data.volume <= 0) {
    return `На уровне ${price} в колонке ${sideLabel.toUpperCase()} сейчас нет видимого объёма. Это симуляция — уровень можно выбрать для сравнения с соседними строками.`;
  }

  const parts: string[] = [];

  if (data.isLarge) {
    parts.push(
      data.side === "ask"
        ? `На уровне ${price} стоит крупная ask-плотность (${vol} лотов). Рыночные покупки должны забрать этот объём, чтобы цена прошла выше.`
        : `На уровне ${price} стоит крупная bid-плотность (${vol} лотов). Рыночные продажи должны снять поддержку, чтобы цена ушла ниже.`,
    );
  } else {
    parts.push(
      `Уровень ${price}, сторона ${sideLabel.toUpperCase()}: объём ${vol} (${data.pctOfScale.toFixed(0)}% от масштаба стакана).`,
    );
  }

  if (data.isRoundLevel) {
    parts.push("Круглый психологический уровень — здесь часто скапливают лимитки и стопы в учебных примерах.");
  }

  const iceberg = data.side === "ask" ? data.askIceberg : data.bidIceberg;
  if (iceberg) {
    parts.push(
      "Похоже на айсберг: после сделок видимый объём снова появляется — в симуляторе это учебная модель скрытой ликвидности.",
    );
  }

  if (data.tradeCount > 0) {
    parts.push(
      `По цене прошло ${data.tradeCount} симулированных сделок в ленте${data.aggressorHint ? ` (последняя — ${data.aggressorHint === "buy" ? "покупка" : "продажа"})` : ""}.`,
    );
  }

  if (data.isMarketMaker) {
    parts.push("Уровень отмечен как зона маркетмейкера в модели стакана.");
  }

  return parts.join(" ");
}
