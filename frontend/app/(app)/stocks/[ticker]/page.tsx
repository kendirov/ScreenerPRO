import { notFound } from "next/navigation";
import { InstrumentLayout } from "@/components/instrument/instrument-layout";
import { instrumentDetails } from "@/lib/mock/screener";
import { tickerSchema } from "@/lib/validation/schemas";
import { getInstrumentDetail } from "@/lib/server/services/screener-query";
import type { InstrumentDetail } from "@/lib/types/market";

export default async function StockTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const parsed = tickerSchema.safeParse(ticker.toUpperCase());
  if (!parsed.success) notFound();

  const backendDetail = await getInstrumentDetail(parsed.data);
  const detail: InstrumentDetail | undefined = backendDetail
    ? {
        ticker: backendDetail.ticker,
        market: backendDetail.assetClass,
        title: backendDetail.shortName,
        description: `MOEX ${backendDetail.assetClass} instrument from normalized backend feed.`,
        metrics: [
          { label: "Last", value: backendDetail.snapshot?.lastPrice ?? 0, suffix: "", delta: backendDetail.snapshot?.percentChange ?? undefined },
          { label: "Volume", value: backendDetail.snapshot?.volume ?? 0 },
          { label: "Turnover", value: backendDetail.snapshot?.turnover ?? 0 },
          { label: "In-Play Score", value: backendDetail.metrics?.inPlayScore ?? 0 },
        ],
      }
    : instrumentDetails[parsed.data];
  if (!detail) notFound();

  return <InstrumentLayout detail={detail} />;
}
