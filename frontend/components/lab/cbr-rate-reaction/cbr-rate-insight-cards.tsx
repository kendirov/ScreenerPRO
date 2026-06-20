"use client";

import { Activity, AlertTriangle, BarChart3, Telescope } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import type { CbrCockpitInsight } from "@/lib/domain/cbr-rate-cockpit";
import { cn } from "@/lib/utils/cn";

const ICONS = {
  "lead-instrument": Activity,
  "false-impulse": AlertTriangle,
  "volume-location": BarChart3,
  "next-time": Telescope,
} as const;

export function CbrRateInsightCards({ insights }: { insights: CbrCockpitInsight[] }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
      {insights.map((insight) => {
        const Icon = ICONS[insight.kind];
        return (
          <LabGlassPanel
            key={insight.kind}
            depth={10}
            className={cn(
              "p-2",
              insight.empty && "opacity-70",
              insight.ticker && "ring-1 ring-lab-cyan/15",
            )}
          >
            <div className="flex items-start gap-1.5">
              <Icon className="mt-0.5 h-3 w-3 shrink-0 text-lab-dim" aria-hidden />
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.08em] text-lab-dim">{insight.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-lab-text">
                  {insight.ticker ? (
                    <>
                      <span className="font-mono text-lab-cyan/90">{insight.ticker}</span>
                      <span className="text-lab-muted"> — {insight.body}</span>
                    </>
                  ) : (
                    insight.body
                  )}
                </p>
              </div>
            </div>
          </LabGlassPanel>
        );
      })}
    </div>
  );
}
