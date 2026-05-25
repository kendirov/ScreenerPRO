"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { getSessionPulseInfo } from "@/lib/domain/session-phase";
import { cn } from "@/lib/utils/cn";

export function SessionPulseCard({ className }: { className?: string }) {
  const pulse = getSessionPulseInfo();

  return (
    <article
      className={cn(
        "lab-glass-panel relative flex flex-wrap items-center justify-between gap-3 overflow-hidden px-4 py-3",
        !pulse.available && "border-dashed",
        className,
      )}
    >
      <div className="lab-accent-line absolute inset-x-0 top-0 opacity-40" aria-hidden />
      <div className="relative flex min-w-[200px] flex-1 items-start gap-3">
        <div className="rounded-md border border-lab-cyan/25 bg-lab-cyan/8 p-2 text-lab-cyan">
          <Clock className="h-4 w-4" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="lab-type-section text-xs">Пульс сессии</h2>
            <span className="lab-status-chip lab-chip-soon text-[9px]">Скоро</span>
          </div>
          <p className="lab-type-caption mt-0.5 text-xs">Лаборатория времени сессии — в разработке</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>
              <span className="text-lab-dim">МСК </span>
              <span className="lab-number font-medium text-lab-text">{pulse.moscowTime}</span>
            </span>
            <span>
              <span className="text-lab-dim">Фаза </span>
              <span className="text-lab-text">{pulse.phase}</span>
            </span>
            <span>
              <span className="text-lab-dim">Далее </span>
              <span className="text-lab-muted">{pulse.nextEvent}</span>
            </span>
          </div>
        </div>
      </div>
      {pulse.available ? (
        <Link
          href={pulse.href}
          className="lab-status-chip lab-chip-live relative shrink-0 px-3 py-1.5 text-xs font-medium"
        >
          Открыть
        </Link>
      ) : (
        <span
          className="lab-status-chip lab-chip-dev relative shrink-0 cursor-not-allowed px-3 py-1.5 text-xs"
          title="Лаборатория в разработке"
        >
          Скоро
        </span>
      )}
    </article>
  );
}
