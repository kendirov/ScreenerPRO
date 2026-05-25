import { Bell, UserCircle2 } from "lucide-react";
import { DataBadge, StatusPill } from "@/components/ui/primitives";

export function TopBar() {
  return (
    <header className="lab-glass-panel sticky top-0 z-40 rounded-none border-x-0 border-t-0 px-1.5 py-2 sm:px-2.5 lg:px-3">
      <div className="lab-accent-line mb-2 opacity-60" aria-hidden />
      <div className="flex items-center gap-2">
        <div className="lab-glass-card rounded-lg border-lab-border bg-lab-surface-glass/80 px-2 py-1.5 shadow-none hover:translate-y-0">
          <DataBadge label="MOEX ISS" />
        </div>
        <div className="lab-glass-card rounded-lg border-lab-border bg-lab-surface-glass/80 px-2 py-1.5 shadow-none hover:translate-y-0">
          <StatusPill status="open" />
        </div>
        <button className="lab-glass-card rounded-lg p-2 text-lab-muted shadow-none transition-all duration-200 hover:border-lab-border-hot hover:text-lab-text">
          <Bell className="h-4 w-4" />
        </button>
        <button className="lab-glass-card flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-lab-muted shadow-none transition-all duration-200 hover:border-lab-border-hot hover:text-lab-text">
          <UserCircle2 className="h-4 w-4" />
          Пользователь
        </button>
      </div>
    </header>
  );
}
