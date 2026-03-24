import type { ReactNode } from "react";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { TopBar } from "@/components/shell/top-bar";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_18%_-10%,rgba(30,41,59,0.22),transparent_60%),radial-gradient(900px_500px_at_100%_0%,rgba(15,23,42,0.32),transparent_58%),#000] text-slate-200">
      <div className="flex min-h-screen">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="min-w-0 flex-1 px-1.5 pb-2.5 pt-1.5 sm:px-2.5 sm:pb-3 sm:pt-2 lg:px-3">{children}</main>
        </div>
      </div>
    </div>
  );
}
