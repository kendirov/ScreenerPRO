"use client";

import Link from "next/link";
import { ArrowUpRight, Radio } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";

export function InflationBriefingBridge({
  hasData,
  className,
}: {
  hasData: boolean;
  className?: string;
}) {
  return (
    <LabGlassPanel depth={10} variant={hasData ? "success" : "amber"} className={cn("px-4 py-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Radio className="mt-0.5 h-4 w-4 shrink-0 text-lab-cyan" />
          <div>
            <p className="text-sm font-medium text-lab-text">Связь с брифингом</p>
            <p className="mt-1 text-[11px] leading-relaxed text-lab-muted">
              {hasData
                ? "Последняя неделя, 4w импульс и режим попадут в карточку «Недельная инфляция» на подготовке, в порядок эфира и Telegram-summary."
                : "После первой недели данные автоматически появятся на /lab/preparation — карточка инфляции, строка «Инфляция / ставка» и Telegram."}
            </p>
          </div>
        </div>
        <Link
          href="/lab/preparation"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-lab-border px-2.5 py-1.5 text-[11px] text-lab-text hover:border-lab-cyan/30 hover:bg-lab-cyan/8"
        >
          Подготовка
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </LabGlassPanel>
  );
}
