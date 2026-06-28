import { buildStocksRadarModel, prepareStockUniverse, applyIlliquidFilter } from "../lib/screener/stocks-radar";

const WATCH = [
  "SBER",
  "GAZP",
  "T",
  "NVTK",
  "ROSN",
  "SMLT",
  "LKOH",
  "POSI",
  "AFKS",
  "YDEX",
  "VTBR",
  "MAGN",
  "ASTR",
  "ETLN",
  "GMKN",
];

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
  const visibleAfterIlliquid = applyIlliquidFilter(model.normalizedRows, true).length;
  const ru000InUniverse = model.normalizedRows.filter((r) => /^RU000/i.test(r.ticker)).length;
  const inGame = model.diagnostics.inGame;

  const shortlistTickers = inGame?.shortlistTickers ?? [];
  const cardTickers = model.inPlayLeaders.map((l) => l.row.ticker);

  const watchReport = WATCH.map((ticker) => {
    const row = model.normalizedRows.find((r) => r.ticker === ticker);
    if (!row) return { ticker, found: false };
    return {
      ticker,
      found: true,
      inShortlist: row.isInGame,
      reason: row.reasons[0] ?? null,
      trades: row.trades,
      turnover: row.turnover,
      rangePct: row.rangePct,
      changePct: row.changePct,
      score: Math.round(row.inPlayScore),
    };
  });

  const topShortlist = model.normalizedRows
    .filter((r) => r.isInGame)
    .sort((a, b) => b.inPlayScore - a.inPlayScore)
    .slice(0, 30)
    .map((r) => ({
      ticker: r.ticker,
      changePct: r.changePct,
      rangePct: r.rangePct,
      trades: r.trades,
      turnover: r.turnover,
      score: Math.round(r.inPlayScore),
      reason: r.reasons[0],
    }));

  console.log(
    JSON.stringify(
      {
        url,
        source: data.status?.source,
        isDemo: data.status?.isDemo,
        fallbackReason: data.status?.fallbackReason,
        rawRows: audit.rawRows,
        validStockUniverse: audit.universeCount,
        visibleAfterIlliquid,
        ru000InUniverse,
        breadthSumOk: audit.sum === audit.universeCount,
        marketBreadth: model.diagnostics.marketBreadth,
        indexBreadth: model.diagnostics.indexBreadth,
        indexBreadthSumOk: model.diagnostics.indexBreadth.sum === model.diagnostics.indexBreadth.matchedCount,
        marketSummaryIndexBreadth: model.marketSummary.indexBreadth,
        marketRegime: inGame?.marketRegime,
        indexChangePct: inGame?.indexChangePct,
        indexRangePct: inGame?.indexRangePct,
        breadthActiveRatio: inGame?.breadthActiveRatio,
        targetMin: inGame?.targetMin,
        targetMax: inGame?.targetMax,
        minScoreUsed: inGame?.minScoreUsed,
        candidates: inGame?.candidateCount,
        shortlist: inGame?.shortlistCount,
        displayed: model.inPlayLeaders.length,
        hidden: Math.max((inGame?.shortlistCount ?? 0) - cardTickers.length, 0),
        rejectedByHardFilters: inGame?.rejectedByHardFilters,
        rejectedByScore: inGame?.rejectedByScore,
        shortlistTickers,
        cardDisplayedTickers: cardTickers,
        topShortlist,
        topRejectedHighTrades: inGame?.topRejected ?? [],
        watchReport,
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
