"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FuturesFamilyTable } from "@/components/screener/futures-family-table";
import { FuturesAllTable } from "@/components/screener/futures-all-table";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";

type FuturesViewMode = "groups" | "all";

export function FuturesScreenerPage() {
  const futuresQuery = useScreenerQuery("future");
  const rows = futuresQuery.data?.rows ?? [];
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const viewParam = searchParams.get("view");
  const mode: FuturesViewMode = viewParam === "groups" ? "groups" : "all";

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
      <div className="rounded-xl border border-white/5 bg-[linear-gradient(110deg,rgba(2,6,23,0.7),rgba(2,6,23,0.52)_45%,rgba(15,23,42,0.36)_100%)] px-3 py-2 shadow-[0_10px_24px_rgba(2,6,23,0.25)] backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-xl border border-white/10 bg-black/25 p-1">
            <button
              type="button"
              onClick={() => setMode("groups")}
              className={`rounded-lg px-3 py-1.5 text-xs ${mode === "groups" ? "bg-slate-700 text-white" : "text-slate-400"}`}
            >
              Группы
            </button>
            <button
              type="button"
              onClick={() => setMode("all")}
              className={`rounded-lg px-3 py-1.5 text-xs ${mode === "all" ? "bg-slate-700 text-white" : "text-slate-400"}`}
            >
              Все
            </button>
          </div>
          <span className="font-mono text-[11px] text-slate-400">Фьючерсы: {rows.length}</span>
        </div>
      </div>

      {mode === "groups" ? <FuturesFamilyTable rows={rows} /> : <FuturesAllTable rows={rows} />}
    </div>
  );
}
