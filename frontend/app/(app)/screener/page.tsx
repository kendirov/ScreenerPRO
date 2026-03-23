import { ScreenerTable } from "@/components/screener/screener-table";
import { SectionHeader } from "@/components/ui/primitives";
import { screenerRows } from "@/lib/mock/screener";
import type { ScreenerRow } from "@/lib/types/market";
import { getScreenerRows } from "@/lib/server/services/screener-query";

async function getRows(): Promise<ScreenerRow[]> {
  try {
    return await getScreenerRows("all");
  } catch {
    return screenerRows;
  }
}

export default async function ScreenerPage() {
  const rows = await getRows();
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Main Screener"
        subtitle="Typed mock market data with sorting, virtualized rendering, and premium interaction patterns."
      />
      <ScreenerTable rows={rows} />
    </div>
  );
}
