import { buildStocksRadarModel, prepareStockUniverse } from "../lib/screener/stocks-radar";

async function main() {
  const url = process.argv[2] ?? "https://screenerpro.vercel.app/api/screener?assetClass=stock";
  const res = await fetch(url);
  const data = await res.json();
  const rows = data.rows ?? [];
  const bench =
    data.benchmarks?.find((b: { code: string }) => b.code === "IMOEX2") ??
    data.benchmarks?.find((b: { code: string }) => b.code === "IMOEX") ??
    data.benchmarks?.[0] ??
    null;

  const { audit } = prepareStockUniverse(rows);
  const model = buildStocksRadarModel(rows, bench);
  const { filterValidStockUniverse } = await import("../lib/screener/stock-universe-filter");
  const { applyIlliquidFilter } = await import("../lib/screener/stocks-radar");
  const visibleAfterIlliquid = applyIlliquidFilter(model.normalizedRows, true).length;
  const ru000InUniverse = model.normalizedRows.filter((r) => /^RU000/i.test(r.ticker)).length;

  console.log(
    JSON.stringify(
      {
        url,
        source: data.status?.source,
        isDemo: data.status?.isDemo,
        fallbackReason: data.status?.fallbackReason,
        rawRows: audit.rawRows,
        universeCount: audit.universeCount,
        visibleAfterIlliquid,
        ru000InUniverse,
        normalizedRows: model.normalizedRows.length,
        rising: audit.risingCount,
        falling: audit.fallingCount,
        flat: audit.flatCount,
        sum: audit.sum,
        sumOk: audit.sum === audit.universeCount,
        duplicatesRemoved: audit.duplicatesRemoved,
        invalidRowsRemoved: audit.invalidRowsRemoved,
        nonStockRemoved: audit.nonStockRemoved,
        totalTurnover: model.marketSummary.totalTurnover,
        totalTrades: model.marketSummary.totalTrades,
        filteredIlliquidCount: model.diagnostics.filteredIlliquidCount,
        index: bench
          ? {
              code: bench.code,
              last: bench.lastPrice,
              changePct: bench.percentChange,
              rangePct: bench.dayRangePct,
            }
          : null,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
