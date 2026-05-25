"use client";

import type { CorrelationApiFactorId, CorrelationFactorSummary, CorrelationOverviewResponse } from "@/lib/domain/correlation-api";
import { CorrelationFactorCard } from "@/components/lab/correlation-lab/correlation-factor-card";

export function CorrelationFactorGrid({
  overview,
  selectedId,
  onOpenFactor,
  onCheckSource,
}: {
  overview: CorrelationOverviewResponse;
  selectedId: CorrelationApiFactorId | null;
  onOpenFactor: (id: CorrelationApiFactorId) => void;
  onCheckSource?: () => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {overview.factors.map((factor) => (
        <CorrelationFactorCard
          key={factor.id}
          factor={factor}
          overview={overview}
          selected={selectedId === factor.id}
          onOpen={onOpenFactor}
          onCheckSource={onCheckSource}
        />
      ))}
    </div>
  );
}

export type { CorrelationFactorSummary };
