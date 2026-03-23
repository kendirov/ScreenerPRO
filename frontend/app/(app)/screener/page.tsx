import { ScreenerTable } from "@/components/screener/screener-table";
import { SectionHeader } from "@/components/ui/primitives";
import { screenerRows } from "@/lib/mock/screener";

export default function ScreenerPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Main Screener"
        subtitle="Typed mock market data with sorting, virtualized rendering, and premium interaction patterns."
      />
      <ScreenerTable rows={screenerRows} />
    </div>
  );
}
