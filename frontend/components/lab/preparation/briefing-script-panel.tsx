"use client";

import * as React from "react";
import { Check, Copy, FileText, MessageSquare } from "lucide-react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import type { BriefingMode } from "@/components/lab/preparation/preparation-types";
import {
  buildBriefingScriptText,
  buildTelegramSummary,
  type BriefingOutlineItem,
} from "@/lib/domain/preparation-briefing-outline";
import type { WeeklyInflationBrief } from "@/lib/domain/weekly-inflation-storage";
import type { MarketDriver } from "@/lib/domain/preparation-events";
import { cn } from "@/lib/utils/cn";

export function BriefingScriptPanel({
  mode,
  outline,
  drivers,
  inflationBrief,
  className,
}: {
  mode: BriefingMode;
  outline: BriefingOutlineItem[];
  drivers: MarketDriver[];
  inflationBrief: WeeklyInflationBrief;
  className?: string;
}) {
  const [hideEmpty, setHideEmpty] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const scriptText = React.useMemo(
    () => buildBriefingScriptText(outline, mode, hideEmpty),
    [outline, mode, hideEmpty],
  );

  const telegramText = React.useMemo(
    () => buildTelegramSummary(outline, drivers, inflationBrief.telegramLine),
    [outline, drivers, inflationBrief.telegramLine],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(scriptText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <section className="lab-glass-panel relative overflow-hidden p-3">
        <div className="lab-accent-line absolute inset-x-0 top-0 opacity-30" aria-hidden />
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <LabSectionHeading className="mb-1 flex items-center gap-1.5 text-lab-violet/90">
              <FileText className="h-3.5 w-3.5" />
              Черновик эфира
            </LabSectionHeading>
            <p className="text-[11px] text-lab-muted">
              Автособранный шаблон из выбранных блоков — без генерации ИИ.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setHideEmpty((value) => !value)}
              className={cn(
                "lab-status-chip px-2 py-1 text-[10px] transition",
                hideEmpty
                  ? "border-lab-violet/35 bg-lab-violet/10 text-lab-violet"
                  : "text-lab-muted hover:text-lab-text",
              )}
            >
              {hideEmpty ? "Показать пустые" : "Скрыть пустые блоки"}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-md border border-lab-cyan/35 bg-lab-cyan/10 px-2 py-1 text-[10px] text-lab-cyan transition hover:shadow-[var(--lab-glow-cyan)]"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Скопировано" : "Скопировать структуру"}
            </button>
          </div>
        </div>

        <pre
          className="mt-3 max-h-[min(420px,50vh)] overflow-y-auto rounded-lg border border-lab-border/70 bg-lab-bg-deep/80 p-3 font-mono text-[11px] leading-relaxed text-lab-muted whitespace-pre-wrap"
          aria-readonly
        >
          {scriptText}
        </pre>
      </section>

      <section className="lab-glass-panel p-3">
        <LabSectionHeading className="mb-2 flex items-center gap-1.5 text-lab-cyan/90">
          <MessageSquare className="h-3.5 w-3.5" />
          Короткий итог для Telegram
        </LabSectionHeading>
        <pre className="overflow-x-auto rounded-lg border border-lab-border/70 bg-lab-bg-deep/80 p-3 font-mono text-[10px] leading-relaxed text-lab-muted whitespace-pre-wrap">
          {telegramText}
        </pre>
        <p className="mt-2 text-[10px] text-lab-dim">
          3–5 строк · только активные драйверы и выбранные инструменты · проверить перед отправкой.
        </p>
      </section>
    </div>
  );
}
