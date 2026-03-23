import { EmptyState, SectionHeader } from "@/components/ui/primitives";

export default function WatchlistPage() {
  return (
    <div className="space-y-4">
      <SectionHeader title="Watchlist" subtitle="User-specific instrument baskets will be sourced from Supabase later." />
      <EmptyState title="No watchlists yet" text="Create and sync watchlists after auth integration in the next step." />
    </div>
  );
}
