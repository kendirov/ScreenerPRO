import type { ScreenerRow } from "@screenerpro/shared";
import type { MarketPriorityResult, PriorityInstrument } from "@/lib/screener/market-priority-engine";
import { formatSectorKMagnitudePercent, formatSectorKPercent, formatSectorKTurnover } from "@/lib/sector-k/market";

type StockPriority = PriorityInstrument<ScreenerRow>;

function changeClass(value: number | null | undefined): string {
  if (value == null || value === 0) return "";
  return value > 0 ? "sk-change--positive" : "sk-change--negative";
}

function RadarHead({ title, count, total }: { title: string; count: number; total?: number }) {
  return (
    <header className="sk-stock-radar__head">
      <strong>{title}</strong>
      <span className="sk-mono">{total == null ? count || "—" : count ? `Σ ${formatSectorKTurnover(total)}` : "—"}</span>
    </header>
  );
}

function CompactLeader({ item, onFocus }: { item: StockPriority; onFocus: (ticker: string) => void }) {
  const row = item.row;
  return (
    <button className="sk-stock-radar__leader" type="button" onClick={() => onFocus(row.ticker)} title={row.shortName}>
      <strong>{row.ticker}</strong>
      <span className="sk-mono">{formatSectorKTurnover(row.turnover)}</span>
    </button>
  );
}

function FocusCard({ item, onFocus }: { item: StockPriority; onFocus: (ticker: string) => void }) {
  const row = item.row;
  return (
    <button className="sk-stock-radar__focus-card" type="button" onClick={() => onFocus(row.ticker)} title={row.shortName}>
      <span className="sk-stock-radar__focus-top">
        <strong>{row.ticker}</strong>
        <b className={changeClass(row.percentChange)}>{formatSectorKPercent(row.percentChange)}</b>
      </span>
      <span className="sk-stock-radar__focus-meta sk-mono">
        <span>↕ {formatSectorKMagnitudePercent(row.metrics.dayRangePct)}</span>
        <span>{formatSectorKTurnover(row.turnover)}</span>
      </span>
    </button>
  );
}

function VolatilityLeader({ item, onFocus }: { item: StockPriority; onFocus: (ticker: string) => void }) {
  const row = item.row;
  return (
    <button className="sk-stock-radar__shot" type="button" onClick={() => onFocus(row.ticker)} title={row.shortName}>
      <strong>{row.ticker}</strong>
      <span className={`sk-mono ${changeClass(row.percentChange)}`}>{formatSectorKPercent(row.percentChange)}</span>
      <small className="sk-mono">↕ {formatSectorKMagnitudePercent(row.metrics.dayRangePct)}</small>
    </button>
  );
}

export function SectorKStockRadar({
  priority,
  onFocus,
}: {
  priority: MarketPriorityResult<ScreenerRow>;
  onFocus: (ticker: string) => void;
}) {
  const liquidityLeaders = [...priority.liquidityLeaders].sort(
    (left, right) => (right.row.turnover ?? 0) - (left.row.turnover ?? 0),
  );
  const liquidityTurnover = liquidityLeaders.reduce((sum, item) => sum + (item.row.turnover ?? 0), 0);

  return (
    <section className="sk-stock-radar" aria-label="Ликвидность, акции в игре и прострелы">
      <div className="sk-stock-radar__rail sk-stock-radar__rail--liquidity">
        <RadarHead title="Ликвидность" count={liquidityLeaders.length} total={liquidityTurnover} />
        <div className="sk-stock-radar__leaders">
          {liquidityLeaders.map((item) => <CompactLeader item={item} onFocus={onFocus} key={item.secid} />)}
        </div>
      </div>

      <div className="sk-stock-radar__focus">
        <RadarHead title="В игре" count={priority.focusInPlayLeaders.length} />
        <div className="sk-stock-radar__focus-grid">
          {priority.focusInPlayLeaders.map((item) => <FocusCard item={item} onFocus={onFocus} key={item.secid} />)}
          {!priority.focusInPlayLeaders.length ? <span className="sk-stock-radar__empty sk-mono">—</span> : null}
        </div>
      </div>

      <div className="sk-stock-radar__rail sk-stock-radar__rail--shots">
        <RadarHead title="Прострелы" count={priority.volatilityLeaders.length} />
        <div className="sk-stock-radar__leaders">
          {priority.volatilityLeaders.map((item) => <VolatilityLeader item={item} onFocus={onFocus} key={item.secid} />)}
          {!priority.volatilityLeaders.length ? <span className="sk-stock-radar__empty sk-mono">—</span> : null}
        </div>
      </div>
    </section>
  );
}
