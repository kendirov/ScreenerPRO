"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FuturesFamilyTable } from "@/components/screener/futures-family-table";
import { FuturesAllTable } from "@/components/screener/futures-all-table";
import { ScreenerPageHeader } from "@/components/screener/screener-page-chrome";
import { cn } from "@/lib/utils/cn";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";

type FuturesViewMode = "groups" | "all";

export function FuturesScreenerPage() {
  const futuresQuery = useScreenerQuery("future");
  const rows = futuresQuery.data?.rows ?? [];
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const viewParam = searchParams.get("view");
  const mode: FuturesViewMode = viewParam === "all" ? "all" : "groups";

  React.useEffect(() => {
    if (!viewParam) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("view", "all");
      router.replace(`${pathname}?${next.toString()}`);
    }
  }, [pathname, router, searchParams, viewParam]);

  function setMode(nextMode: FuturesViewMode) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", nextMode);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="space-y-2">
      <ScreenerPageHeader
        title="Рынок · Фьючерсы"
        right={<span className="lab-chip font-mono text-[11px]">Контрактов: {rows.length}</span>}
      >
        <div className="inline-flex rounded-lg border border-lab-border-soft bg-lab-surface-1 p-0.5">
          <button
            type="button"
            onClick={() => setMode("all")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs transition",
              mode === "all"
                ? "lab-chip-active border-transparent bg-lab-cyan/12 text-lab-cyan shadow-none"
                : "text-lab-text-muted hover:text-lab-text-main",
            )}
          >
            Все
          </button>
          <button
            type="button"
            onClick={() => setMode("groups")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs transition",
              mode === "groups"
                ? "lab-chip-active border-transparent bg-lab-cyan/12 text-lab-cyan shadow-none"
                : "text-lab-text-muted hover:text-lab-text-main",
            )}
          >
            Группы
          </button>
        </div>
      </ScreenerPageHeader>

      {mode === "groups" ? <FuturesFamilyTable rows={rows} /> : <FuturesAllTable rows={rows} />}
    </div>
  );
}
