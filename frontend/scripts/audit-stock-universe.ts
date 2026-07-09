/**
 * Dev audit: stock screener universe vs stock-only filter.
 * pnpm -C frontend audit:stock-universe [api-url]
 */
import { auditStockUniverse, filterValidStockUniverse } from "../lib/screener/stock-universe-filter";

async function main() {
  const url = process.argv[2] ?? "http://localhost:3000/api/screener?assetClass=stock";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const data = (await res.json()) as { rows?: unknown[]; status?: { source?: string } };
  const rows = data.rows ?? [];

  const audit = auditStockUniverse(rows);
  const { universe, audit: filterAudit } = filterValidStockUniverse(rows as never);

  const mustInclude = ["SBER", "SBERP", "TRNFP", "VTBR", "IRAO", "SIBN", "X5"];
  const includeCheck = Object.fromEntries(
    mustInclude.map((ticker) => [ticker, universe.some((r) => r.ticker === ticker)]),
  );

  console.log(
    JSON.stringify(
      {
        url,
        source: data.status?.source ?? null,
        beforeFilter: audit.total,
        stockOnlyAfterFilter: universe.length,
        auditSummary: {
          tickerLikeSecids: audit.tickerLikeSecids,
          ru000Secids: audit.ru000Secids,
          likelyStocks: audit.likelyStocks,
          likelyPreferredStocks: audit.likelyPreferredStocks,
          likelyEtfs: audit.likelyEtfs,
          likelyFunds: audit.likelyFunds,
          likelyBonds: audit.likelyBonds,
          unknown: audit.unknown,
          byCategory: audit.byCategory,
        },
        filterPipeline: {
          rawRows: filterAudit.rawRows,
          invalidRowsRemoved: filterAudit.invalidRowsRemoved,
          excludedBondLike: filterAudit.excludedBondLike,
          excludedFunds: filterAudit.excludedFunds,
          excludedEtfs: filterAudit.excludedEtfs,
          duplicatesRemoved: filterAudit.duplicatesRemoved,
        },
        mustIncludeCheck: includeCheck,
        topExcluded: audit.topExcluded,
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
