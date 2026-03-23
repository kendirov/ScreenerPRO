import { notFound } from "next/navigation";
import { InstrumentLayout } from "@/components/instrument/instrument-layout";
import { instrumentDetails } from "@/lib/mock/screener";
import { tickerSchema } from "@/lib/validation/schemas";
import { getInstrumentDetail } from "@/lib/server/services/screener-query";
import type { InstrumentDetail } from "@/lib/types/market";

export default async function FuturesTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const parsed = tickerSchema.safeParse(ticker);
  if (!parsed.success) notFound();

  const backendDetail = await getInstrumentDetail(parsed.data);
  const detail: InstrumentDetail | undefined = backendDetail
    ? {
        ticker: backendDetail.ticker,
        market: backendDetail.assetClass,
        title: backendDetail.shortName,
        description: `Инструмент MOEX (${backendDetail.assetClass === "stock" ? "акция" : "фьючерс"}) из нормализованного backend-потока.`,
        metrics: [
          { label: "Цена", value: backendDetail.snapshot?.lastPrice ?? 0, suffix: "", delta: backendDetail.snapshot?.percentChange ?? undefined },
          { label: "Объем", value: backendDetail.snapshot?.volume ?? 0 },
          { label: "Оборот", value: backendDetail.snapshot?.turnover ?? 0 },
          { label: "In-Play Score", value: backendDetail.metrics?.inPlayScore ?? 0 },
        ],
      }
    : instrumentDetails[parsed.data];
  if (!detail) notFound();

  return <InstrumentLayout detail={detail} />;
}
