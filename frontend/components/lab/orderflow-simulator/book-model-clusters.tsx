"use client";

import type { BookModelClusterCell } from "@/lib/domain/book-model-scenarios";
import type { BookModelSnapshot } from "@/components/lab/orderflow-simulator/simple-order-book-model";
import { formatPrice } from "@/lib/formatters/number";
import { cn } from "@/lib/utils/cn";

const ROW_HEIGHT_PX = 18;
const SPREAD_ROW_PX = 22;

type BookModelClustersProps = {
  cells: BookModelClusterCell[];
  snapshot: BookModelSnapshot;
  height: number;
  presentation?: boolean;
};

function priceToRowTop(price: number, snapshot: BookModelSnapshot, laneHeight: number): number {
  const { asks, bids, tickSize } = snapshot;
  const askIndex = asks.findIndex((l) => Math.abs(l.price - price) < tickSize / 2);
  if (askIndex >= 0) {
    return askIndex * ROW_HEIGHT_PX + ROW_HEIGHT_PX / 2;
  }
  const bidIndex = bids.findIndex((l) => Math.abs(l.price - price) < tickSize / 2);
  if (bidIndex >= 0) {
    return asks.length * ROW_HEIGHT_PX + SPREAD_ROW_PX + bidIndex * ROW_HEIGHT_PX + ROW_HEIGHT_PX / 2;
  }
  return laneHeight / 2;
}

export function BookModelClusters({ cells, snapshot, height, presentation = false }: BookModelClustersProps) {
  const visible = cells.filter((c) => c.buyVol > 0 || c.sellVol > 0);
  const maxVol = Math.max(...visible.flatMap((c) => [c.buyVol, c.sellVol]), 1);

  return (
    <div
      className={cn(
        "book-model-clusters flex w-[52px] shrink-0 flex-col",
        presentation && "book-model-clusters--presentation",
      )}
    >
      <p
        className={cn(
          "mb-1 text-center font-mono uppercase tracking-wide text-slate-600",
          presentation ? "text-[11px] text-slate-400" : "text-[8px]",
        )}
      >
        Кластера
      </p>
      <div className="relative flex-1" style={{ height }}>
        {visible.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center px-1 text-center font-mono text-[7px] leading-snug text-slate-700">
            след сделки появится здесь
          </p>
        ) : null}
        {visible.map((cell) => {
          const top = priceToRowTop(cell.price, snapshot, height);
          const buyW = cell.buyVol > 0 ? Math.max(4, (cell.buyVol / maxVol) * 24) : 0;
          const sellW = cell.sellVol > 0 ? Math.max(4, (cell.sellVol / maxVol) * 24) : 0;
          return (
            <div
              key={cell.price}
              className="absolute right-0 flex flex-col items-end gap-px"
              style={{ top, transform: "translateY(-50%)" }}
              title={`${formatPrice(cell.price)} · покупки ${cell.buyVol} · продажи ${cell.sellVol}`}
            >
              {cell.buyVol > 0 ? (
                <div className="rounded-sm bg-emerald-500/85" style={{ width: buyW, height: 12 }} />
              ) : null}
              {cell.sellVol > 0 ? (
                <div className="rounded-sm bg-rose-500/85" style={{ width: sellW, height: 12 }} />
              ) : null}
            </div>
          );
        })}
      </div>
      {presentation ? null : (
        <p className="mt-1 px-0.5 text-center font-mono text-[7px] leading-snug text-slate-600">
          Кластер — след уже прошедшей сделки
        </p>
      )}
    </div>
  );
}
