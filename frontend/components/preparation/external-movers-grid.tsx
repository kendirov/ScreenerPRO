"use client";

import type { ExternalMarketGroup } from "@/lib/preparation/preparation-types";
import { ExternalAssetCard } from "@/components/preparation/external-asset-card";

export function ExternalMoversGrid({
  groups,
  noMovers,
}: {
  groups: ExternalMarketGroup[];
  noMovers: boolean;
}) {
  if (!groups.length) {
    return (
      <div className="rounded-md border border-dashed border-white/10 px-3 py-4 text-center">
        <p className="font-mono text-[10px] text-lab-text-dim">Внешний фон недоступен</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {noMovers ? (
        <p className="px-0.5 font-mono text-[10px] text-lab-text-dim">
          Сильных движений во внешнем фоне нет · базовый минимум
        </p>
      ) : null}

      {groups.map((group) => {
        const items = group.movers.length > 0 ? group.movers : group.critical;
        if (!items.length) return null;

        return (
          <section key={group.id}>
            <h3 className="mb-1.5 px-0.5 font-mono text-[9px] uppercase tracking-wider text-lab-text-dim">
              {group.title}
            </h3>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {items.map((asset) => (
                <ExternalAssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
