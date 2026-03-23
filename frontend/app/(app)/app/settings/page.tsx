import { EmptyState, SectionHeader } from "@/components/ui/primitives";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <SectionHeader title="Settings" subtitle="Profile, theme controls, and account settings placeholder." />
      <EmptyState title="Settings scaffold ready" text="Supabase user profile and entitlement preferences plug in here." />
    </div>
  );
}
