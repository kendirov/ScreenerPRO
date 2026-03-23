import { notFound } from "next/navigation";
import { InstrumentLayout } from "@/components/instrument/instrument-layout";
import { instrumentDetails } from "@/lib/mock/screener";
import { tickerSchema } from "@/lib/validation/schemas";

export default async function StockTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const parsed = tickerSchema.safeParse(ticker.toUpperCase());
  if (!parsed.success) notFound();

  const detail = instrumentDetails[parsed.data];
  if (!detail) notFound();

  return <InstrumentLayout detail={detail} />;
}
