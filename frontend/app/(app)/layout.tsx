import type { ReactNode } from "react";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { TopBar } from "@/components/shell/top-bar";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lab-shell lab-gradient-bg lab-grid-bg lab-noise-overlay min-h-screen text-lab-text">
      <div className="flex min-h-screen">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="min-w-0 flex-1 overflow-x-hidden px-1.5 pb-2.5 pt-1.5 sm:px-2.5 sm:pb-3 sm:pt-2 lg:px-3">{children}</main>
        </div>
      </div>
    </div>
  );
}
