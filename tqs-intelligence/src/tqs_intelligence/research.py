from __future__ import annotations

from collections import defaultdict
from statistics import median

from .models import AnomalyEpisode, EpisodeOutcome, ResearchFinding


def _metric(values: list[float]) -> tuple[float | None, float | None]:
    if not values:
        return None, None
    return round(median(values), 4), round(sum(1 for x in values if x > 0) / len(values), 4)


def build_research_findings(rows: list[tuple[AnomalyEpisode, EpisodeOutcome]], now_ms: int,
                            min_samples: int = 5) -> list[ResearchFinding]:
    grouped: dict[str, list[tuple[AnomalyEpisode, EpisodeOutcome]]] = defaultdict(list)
    for episode, outcome in rows:
        if episode.direction not in {"up", "down"}:
            continue
        grouped[episode.pattern_key].append((episode, outcome))

    findings: list[ResearchFinding] = []
    for key, items in grouped.items():
        one_h: list[float] = []
        four_h: list[float] = []
        for episode, outcome in items:
            sign = 1.0 if episode.direction == "up" else -1.0
            r1 = outcome.returns_pct.get("1h")
            r4 = outcome.returns_pct.get("4h")
            if r1 is not None:
                one_h.append(sign * r1)
            if r4 is not None:
                four_h.append(sign * r4)
        n = max(len(one_h), len(four_h))
        if n < min_samples:
            continue
        med1, win1 = _metric(one_h)
        med4, win4 = _metric(four_h)
        candidate = n >= 20 and (
            (med1 is not None and win1 is not None and med1 >= 0.20 and win1 >= 0.60)
            or (med4 is not None and win4 is not None and med4 >= 0.40 and win4 >= 0.60)
        )
        status = "candidate" if candidate else "watch"
        parts = [f"n={n}"]
        if med1 is not None and win1 is not None:
            parts.append(f"1ч: медиана продолжения {med1:+.2f}%, доля положительных {win1:.0%}")
        if med4 is not None and win4 is not None:
            parts.append(f"4ч: медиана продолжения {med4:+.2f}%, доля положительных {win4:.0%}")
        findings.append(ResearchFinding(
            pattern_key=key,
            updated_at_ms=now_ms,
            sample_count=n,
            median_continuation_1h_pct=med1,
            win_rate_1h=win1,
            median_continuation_4h_pct=med4,
            win_rate_4h=win4,
            status=status,
            summary_ru="; ".join(parts) + ". Предварительная статистика, не торговый сигнал.",
        ))
    return sorted(findings, key=lambda x: (x.status == "candidate", x.sample_count), reverse=True)
