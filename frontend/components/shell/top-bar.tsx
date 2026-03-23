import { Bell, Search, UserCircle2 } from "lucide-react";
import { DataBadge, StatusPill } from "@/components/ui/primitives";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="hidden flex-1 items-center rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-400 md:flex">
          <Search className="mr-2 h-4 w-4" />
          Поиск инструментов и метрик...
        </div>
        <DataBadge label="MOEX: сессия" />
        <StatusPill status="open" />
        <button className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:text-slate-100">
          <Bell className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200">
          <UserCircle2 className="h-4 w-4" />
          Пользователь
        </button>
      </div>
    </header>
  );
}
