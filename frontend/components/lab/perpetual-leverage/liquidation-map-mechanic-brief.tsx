"use client";

import { DirectionChartHeader } from "@/components/lab/perpetual-leverage/direction-chart-header";
import type { PositionSide } from "@/lib/domain/perpetual-leverage";

type Props = {
  direction: PositionSide;
  className?: string;
};

export function LiquidationMapMechanicBrief({ direction, className }: Props) {
  return (
    <DirectionChartHeader direction={direction} className={className} />
  );
}
