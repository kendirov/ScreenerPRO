from __future__ import annotations

import math
from collections import defaultdict

from .models import Anomaly, MarketState, Quote


def _percentile_ranks(values: list[float | None]) -> list[float]:
    clean = sorted(v for v in values if v is not None and math.isfinite(v))
    if not clean:
        return [0.0] * len(values)
    result: list[float] = []
    for value in values:
        if value is None or not math.isfinite(value):
            result.append(0.0)
            continue
        less_or_equal = sum(1 for item in clean if item <= value)
        result.append(less_or_equal / len(clean))
    return result


def _severity(score: float) -> str:
    if score >= 85: return "critical"
    if score >= 70: return "high"
    if score >= 50: return "medium"
    return "low"


def _rank_signal(base: str, rank: float) -> str:
    """Stable machine-readable contract: the most extreme tail keeps an explicit suffix."""
    return f"{base}_extreme" if rank >= 0.98 else base


class IntelligenceEngine:
    """Cross-sectional detector. Episode persistence and historical validation live outside this hot path."""

    def analyze(self, quotes: list[Quote]) -> list[Anomaly]:
        groups: dict[tuple[str, str], list[Quote]] = defaultdict(list)
        for quote in quotes:
            if quote.last is not None and quote.last > 0:
                groups[(quote.asset_class.value, quote.market_type)].append(quote)

        anomalies: list[Anomaly] = []
        for group in groups.values():
            change_ranks = _percentile_ranks([abs(q.change_24h_pct) if q.change_24h_pct is not None else None for q in group])
            turnover_ranks = _percentile_ranks([math.log1p(q.turnover_24h) if q.turnover_24h and q.turnover_24h > 0 else None for q in group])
            spread_ranks = _percentile_ranks([q.spread_bps for q in group])
            oi_ranks = _percentile_ranks([math.log1p(q.open_interest) if q.open_interest and q.open_interest > 0 else None for q in group])
            funding_ranks = _percentile_ranks([abs(q.funding_rate) if q.funding_rate is not None else None for q in group])

            for idx, quote in enumerate(group):
                components = [change_ranks[idx], turnover_ranks[idx]]
                if quote.open_interest is not None: components.append(oi_ranks[idx])
                if quote.funding_rate is not None: components.append(funding_ranks[idx])
                score = 100 * (0.58 * max(components) + 0.42 * (sum(components) / len(components)))
                reasons: list[str] = []; signals: list[str] = []
                change = quote.change_24h_pct
                if change is not None and change_ranks[idx] >= 0.90:
                    tail = "верхний 2%" if change_ranks[idx] >= 0.98 else "верхние 10%"
                    reasons.append(f"движение {change:+.2f}% входит в {tail} своей группы")
                    signals.append(_rank_signal("price_move", change_ranks[idx]))
                if quote.turnover_24h is not None and turnover_ranks[idx] >= 0.90:
                    tail = "верхний 2%" if turnover_ranks[idx] >= 0.98 else "верхние 10%"
                    reasons.append(f"оборот входит в {tail} своей группы")
                    signals.append(_rank_signal("turnover", turnover_ranks[idx]))
                if quote.open_interest is not None and oi_ranks[idx] >= 0.90:
                    reasons.append("открытый интерес необычно велик относительно группы")
                    signals.append(_rank_signal("open_interest", oi_ranks[idx]))
                if quote.funding_rate is not None and funding_ranks[idx] >= 0.90:
                    reasons.append("ставка фондирования находится в экстремальной зоне группы")
                    signals.append(_rank_signal("funding", funding_ranks[idx]))
                if quote.spread_bps is not None and spread_ranks[idx] >= 0.95:
                    reasons.append(f"спред расширен: {quote.spread_bps:.1f} б.п.")
                    signals.append("spread_extreme" if spread_ranks[idx] >= 0.98 else "spread")
                    score = min(100.0, score + 4)
                if not reasons and score < 50: continue
                if not signals: signals.append("composite")

                direction = "neutral"
                if change is not None: direction = "up" if change > 0.35 else "down" if change < -0.35 else "flat"
                regime = "expansion" if change is not None and abs(change) >= 3 else "normal"
                activity = "extreme" if score >= 85 else "high" if score >= 70 else "elevated"
                liquidity = "thin" if quote.spread_bps is not None and quote.spread_bps > 30 else "normal"
                state_reasons = reasons.copy() or ["комбинация признаков выделяется относительно текущего рынка"]
                state = MarketState(canonical_id=quote.canonical_id,regime=regime,direction=direction,activity=activity,
                                    liquidity=liquidity,score=round(score, 2),reasons=state_reasons)
                anomalies.append(Anomaly(canonical_id=quote.canonical_id,provider=quote.provider,symbol=quote.symbol,
                    asset_class=quote.asset_class,market_type=quote.market_type,score=round(score, 2),severity=_severity(score),
                    reasons=state_reasons,signals=signals,state=state,quote=quote))
        return sorted(anomalies, key=lambda item: item.score, reverse=True)
