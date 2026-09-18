from __future__ import annotations

import math
from bisect import bisect_right
from collections import defaultdict

from .models import Anomaly, MarketState, Quote


def _percentile_ranks(values: list[float | None]) -> list[float]:
    """Cross-sectional percentile ranks in O(n log n), preserving tie semantics."""
    clean = sorted(v for v in values if v is not None and math.isfinite(v))
    if not clean:
        return [0.0] * len(values)
    total = len(clean)
    result: list[float] = []
    for value in values:
        if value is None or not math.isfinite(value):
            result.append(0.0)
            continue
        result.append(bisect_right(clean, value) / total)
    return result


def _severity(score: float) -> str:
    if score >= 90:
        return "critical"
    if score >= 80:
        return "high"
    if score >= 70:
        return "medium"
    return "low"


def _rank_signal(base: str, rank: float) -> str:
    return f"{base}_extreme" if rank >= 0.98 else base


class IntelligenceEngine:
    """Selective cross-sectional detector.

    This is intentionally a *live attention filter*, not the final historical anomaly
    model. Absolute turnover/OI levels are context, never sufficient triggers by
    themselves. Historical baselines and replay validation live outside this hot path.
    """

    def analyze(self, quotes: list[Quote]) -> list[Anomaly]:
        groups: dict[tuple[str, str], list[Quote]] = defaultdict(list)
        for quote in quotes:
            if quote.last is not None and quote.last > 0:
                groups[(quote.asset_class.value, quote.market_type)].append(quote)

        anomalies: list[Anomaly] = []
        for group in groups.values():
            change_ranks = _percentile_ranks([
                abs(q.change_24h_pct) if q.change_24h_pct is not None else None for q in group
            ])
            turnover_ranks = _percentile_ranks([
                math.log1p(q.turnover_24h) if q.turnover_24h and q.turnover_24h > 0 else None for q in group
            ])
            spread_ranks = _percentile_ranks([q.spread_bps for q in group])
            oi_ranks = _percentile_ranks([
                math.log1p(q.open_interest) if q.open_interest and q.open_interest > 0 else None for q in group
            ])
            funding_ranks = _percentile_ranks([
                abs(q.funding_rate) if q.funding_rate is not None else None for q in group
            ])

            for idx, quote in enumerate(group):
                cr = change_ranks[idx]
                tr = turnover_ranks[idx]
                sr = spread_ranks[idx]
                orank = oi_ranks[idx]
                fr = funding_ranks[idx]
                change = quote.change_24h_pct

                # Hard trigger gate: the old detector promoted high absolute turnover/OI
                # even when price behaviour was ordinary, which made most of the universe
                # look anomalous. A live anomaly now needs an extreme move or a meaningful
                # multi-factor combination. OI/turnover alone remain context only.
                extreme_move = change is not None and cr >= 0.98
                move_turnover = change is not None and cr >= 0.90 and tr >= 0.90
                move_oi = change is not None and cr >= 0.90 and quote.open_interest is not None and orank >= 0.90
                funding_extreme = quote.funding_rate is not None and fr >= 0.99 and tr >= 0.70
                spread_dislocation = quote.spread_bps is not None and sr >= 0.995 and tr >= 0.90 and cr >= 0.80

                if not (extreme_move or move_turnover or move_oi or funding_extreme or spread_dislocation):
                    continue

                weighted: list[tuple[float, float]] = [(cr, 0.58), (tr, 0.24)]
                if quote.open_interest is not None:
                    weighted.append((orank, 0.10))
                if quote.funding_rate is not None:
                    weighted.append((fr, 0.08))
                denom = sum(weight for _, weight in weighted) or 1.0
                score = 100.0 * sum(value * weight for value, weight in weighted) / denom
                if extreme_move:
                    score += 5.0
                if move_turnover:
                    score += 4.0
                if move_oi:
                    score += 3.0
                if funding_extreme:
                    score += 3.0
                score = min(100.0, score)

                reasons: list[str] = []
                signals: list[str] = []
                if change is not None and cr >= 0.90:
                    tail = "верхний 2%" if cr >= 0.98 else "верхние 10%"
                    reasons.append(f"движение {change:+.2f}% входит в {tail} своей группы")
                    signals.append(_rank_signal("price_move", cr))
                if quote.turnover_24h is not None and tr >= 0.90:
                    tail = "верхний 2%" if tr >= 0.98 else "верхние 10%"
                    reasons.append(f"оборот входит в {tail} своей группы")
                    signals.append(_rank_signal("turnover", tr))
                if quote.open_interest is not None and orank >= 0.90:
                    reasons.append("OI высок относительно группы — контекст, не самостоятельный сигнал")
                    signals.append(_rank_signal("open_interest", orank))
                if quote.funding_rate is not None and fr >= 0.90:
                    reasons.append("funding находится в хвосте распределения группы")
                    signals.append(_rank_signal("funding", fr))
                if quote.spread_bps is not None and sr >= 0.95:
                    reasons.append(f"спред расширен: {quote.spread_bps:.1f} б.п.")
                    signals.append("spread_extreme" if sr >= 0.98 else "spread")

                direction = "neutral"
                if change is not None:
                    direction = "up" if change > 0.35 else "down" if change < -0.35 else "flat"
                regime = "expansion" if change is not None and abs(change) >= 3 else "normal"
                activity = "extreme" if score >= 90 else "high" if score >= 80 else "elevated"
                liquidity = "thin" if quote.spread_bps is not None and quote.spread_bps > 30 else "normal"
                state = MarketState(
                    canonical_id=quote.canonical_id,
                    regime=regime,
                    direction=direction,
                    activity=activity,
                    liquidity=liquidity,
                    score=round(score, 2),
                    reasons=reasons,
                )
                anomalies.append(Anomaly(
                    canonical_id=quote.canonical_id,
                    provider=quote.provider,
                    symbol=quote.symbol,
                    asset_class=quote.asset_class,
                    market_type=quote.market_type,
                    score=round(score, 2),
                    severity=_severity(score),
                    reasons=reasons,
                    signals=signals or ["composite"],
                    state=state,
                    quote=quote,
                ))
        return sorted(anomalies, key=lambda item: item.score, reverse=True)
