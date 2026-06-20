"use client";

import { X } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { DataStatusBadge } from "@/components/ui/metrics-minimalism";
import type { CbrInstrumentInspectorView } from "@/lib/domain/cbr-rate-cockpit";
import { cbrDataStatusLabel } from "@/lib/domain/cbr-rate-reaction";

export function CbrRateInstrumentInspector({
  inspector,
  onClose,
}: {
  inspector: CbrInstrumentInspectorView | null;
  onClose: () => void;
}) {
  if (!inspector) return null;

  const badgeKind =
    inspector.dataStatus === "live"
      ? "live"
      : inspector.dataStatus === "partial"
        ? "partial"
        : "fallback";

  return (
    <LabGlassPanel depth={20} className="border-lab-cyan/20 p-2.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-semibold text-lab-cyan">{inspector.ticker}</p>
          <p className="text-[10px] text-lab-muted">{inspector.title}</p>
        </div>
        <div className="flex items-center gap-1">
          <DataStatusBadge kind={badgeKind} label={cbrDataStatusLabel(inspector.dataStatus)} className="text-[8px]" />
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-lab-dim hover:bg-lab-bg-deep/50 hover:text-lab-text"
            aria-label="Закрыть инспектор"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <dl className="space-y-1.5 text-[10px] leading-snug">
        <InspectorRow label="Что произошло" value={inspector.whatHappened} />
        <InspectorRow label="Импульс" value={inspector.impulseRead} />
        <InspectorRow label="Объём" value={inspector.volumeRead} />
        <InspectorRow label="После 15:00" value={inspector.postPressRead} />
      </dl>
    </LabGlassPanel>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-lab-border/35 bg-lab-bg-deep/30 px-2 py-1">
      <dt className="text-[8px] uppercase tracking-[0.1em] text-lab-dim">{label}</dt>
      <dd className="mt-0.5 text-lab-muted">{value}</dd>
    </div>
  );
}
