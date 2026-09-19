import math

from tqs_intelligence.engine import _percentile_ranks


def test_percentile_ranks_preserve_less_or_equal_semantics():
    values = [1.0, 2.0, 2.0, 4.0, None, math.nan]
    ranks = _percentile_ranks(values)
    assert ranks[:4] == [0.25, 0.75, 0.75, 1.0]
    assert ranks[4:] == [0.0, 0.0]


def test_percentile_ranks_handles_large_universe():
    values = [float(i % 1000) for i in range(10000)]
    ranks = _percentile_ranks(values)
    assert len(ranks) == len(values)
    assert max(ranks) == 1.0
