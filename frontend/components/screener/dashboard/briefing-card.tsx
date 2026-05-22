"use client";

import Link from "next/link";
import type { MarketBriefingCard } from "@/lib/domain/screener-overview";
import { cn } from "@/lib/utils/cn";
import { glassCard } from "./dashboard-styles";

interface BriefingCardProps {
  briefing: MarketBriefingCard;
}

const navButtonClass =
  "rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20 hover:bg-black/45 hover:text-slate-100";

export function BriefingCard({ briefing }: BriefingCardProps) {
  return (
    <section className={cn(glassCard, "p-3.5")}>
      <h2 className="text-sm font-semibold tracking-wide text-slate-100">Что смотреть</h2>
      <p className="mt-2 text-sm text-slate-200">{briefing.focusLine}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{briefing.contextLine}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/screener/stocks" className={navButtonClass}>
          Акции
        </Link>
        <Link href="/screener/futures" className={navButtonClass}>
          Фьючерсы
        </Link>
        <Link href="/materials" className={navButtonClass}>
          Материалы
        </Link>
      </div>
    </section>
  );
}
