import { LIQUIDATION_MAP_TAKEAWAY } from "@/lib/domain/liquidation-map-labels";
import { cn } from "@/lib/utils/cn";

type Props = {
  className?: string;
};

export function LiquidationMapTakeaway({ className }: Props) {
  return (
    <p
      className={cn(
        "text-balance text-center text-sm font-medium leading-snug text-slate-300 sm:text-base",
        className,
      )}
    >
      {LIQUIDATION_MAP_TAKEAWAY}
    </p>
  );
}
