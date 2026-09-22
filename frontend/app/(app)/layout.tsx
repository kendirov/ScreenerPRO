import type { ReactNode } from "react";
import { UiViewModeProvider } from "@/lib/hooks/ui-view-mode-context";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { MobileNavigation } from "@/components/shell/mobile-navigation";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <UiViewModeProvider>
      <div className="lab-shell lab-gradient-bg lab-grid-bg lab-noise-overlay min-h-screen text-lab-text">
        <div className="flex min-h-screen">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="lab-page min-w-0 flex-1 overflow-x-hidden px-1.5 pb-20 pt-1.5 sm:px-2.5 sm:pb-20 sm:pt-2 lg:px-3 lg:pb-3">
              {children}
            </main>
          </div>
        </div>
        <MobileNavigation />
      </div>
    </UiViewModeProvider>
  );
}
