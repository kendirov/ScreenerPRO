import { Bell, UserCircle2 } from "lucide-react";
import { DataBadge, StatusPill } from "@/components/ui/primitives";

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/45 px-1.5 py-2 backdrop-blur-2xl sm:px-2.5 lg:px-3">
      <div className="flex items-center gap-2">
        <div className="rounded-lg border border-white/5 bg-black/25 px-2 py-1.5">
          <DataBadge label="MOEX: сессия" />
        </div>
        <div className="rounded-lg border border-white/5 bg-black/25 px-2 py-1.5">
          <StatusPill status="open" />
        </div>
        <button className="rounded-lg border border-white/5 bg-black/30 p-2 text-slate-400 transition-all duration-200 hover:border-slate-700/80 hover:text-slate-100">
          <Bell className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-sm text-slate-300 transition-all duration-200 hover:border-slate-700/80 hover:text-slate-100">
          <UserCircle2 className="h-4 w-4" />
          Пользователь
        </button>
      </div>
    </header>
  );
}
