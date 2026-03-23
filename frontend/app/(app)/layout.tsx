import type { ReactNode } from "react";
import { AppSidebar } from "@/components/shell/app-sidebar";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto flex max-w-[1680px]">
        <AppSidebar />
        <main className="min-w-0 flex-1 px-4 py-4 lg:px-6 lg:py-5">{children}</main>
      </div>
    </div>
  );
}
