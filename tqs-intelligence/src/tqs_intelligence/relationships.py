from __future__ import annotations

import math
from itertools import combinations

from .models import Relationship


def _returns(values: list[float]) -> list[float]:
    out: list[float] = []
    for previous, current in zip(values, values[1:]):
        if previous > 0 and current > 0:
            out.append(math.log(current / previous))
    return out


def _pearson(a: list[float], b: list[float]) -> float | None:
    n = min(len(a), len(b))
    if n < 3:
        return None
    a, b = a[-n:], b[-n:]
    ma, mb = sum(a) / n, sum(b) / n
    va = sum((x - ma) ** 2 for x in a)
    vb = sum((x - mb) ** 2 for x in b)
    if va <= 0 or vb <= 0:
        return None
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / math.sqrt(va * vb)


def mine_relationships(series: dict[str, list[tuple[int, float]]], min_samples: int = 20,
                       max_instruments: int = 60) -> list[Relationship]:
    """Find contemporaneous and one-bucket lead/lag relations on aligned log returns."""
    ranked = sorted(series.items(), key=lambda kv: len(kv[1]), reverse=True)[:max_instruments]
    maps = {key: dict(points) for key, points in ranked}
    results: list[Relationship] = []
    for left, right in combinations(maps, 2):
        common = sorted(set(maps[left]) & set(maps[right]))
        if len(common) < min_samples + 1:
            continue
        l_prices = [maps[left][t] for t in common]
        r_prices = [maps[right][t] for t in common]
        lr, rr = _returns(l_prices), _returns(r_prices)
        corr = _pearson(lr, rr)
        if corr is not None and abs(corr) >= 0.45:
            results.append(Relationship(left_id=left, right_id=right, relation="correlation",
                                        coefficient=round(corr, 4), samples=min(len(lr), len(rr)),
                                        confidence="high" if len(lr) >= 100 else "provisional"))
        if len(lr) >= min_samples + 1:
            left_leads = _pearson(lr[:-1], rr[1:])
            right_leads = _pearson(rr[:-1], lr[1:])
            if left_leads is not None and abs(left_leads) >= 0.35:
                results.append(Relationship(left_id=left, right_id=right, relation="left_leads_right",
                                            coefficient=round(left_leads, 4), samples=len(lr) - 1, lag_buckets=1,
                                            confidence="candidate"))
            if right_leads is not None and abs(right_leads) >= 0.35:
                results.append(Relationship(left_id=left, right_id=right, relation="right_leads_left",
                                            coefficient=round(right_leads, 4), samples=len(lr) - 1, lag_buckets=1,
                                            confidence="candidate"))
    return sorted(results, key=lambda x: abs(x.coefficient), reverse=True)
