from __future__ import annotations

import statistics
import time
from typing import Any
from uuid import uuid4

import polars as pl

from .lab_store import LabStore
from .lake import DataLake
from .metric_lake import MetricLake
from .strategy_machine import StrategyMachine
from .strategy_models import ResearchProject, ResearchRunResult


def _percentile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    rows = sorted(values)
    i = max(0, min(len(rows) - 1, int(round((len(rows) - 1) * q))))
    return rows[i]


def _dist(values: list[float]) -> dict[str, Any]:
    if not values:
        return {"n": 0, "mean": None, "median": None, "positive_rate": None, "p25": None, "p75": None}
    return {
        "n": len(values),
        "mean": statistics.fmean(values),
        "median": statistics.median(values),
        "positive_rate": sum(1 for x in values if x > 0) / len(values),
        "p25": _percentile(values, .25),
        "p75": _percentile(values, .75),
    }


def _split(rows: list[int]) -> dict[str, list[int]]:
    rows = sorted(rows)
    n = len(rows)
    a = int(n * .60)
    b = int(n * .80)
    return {"exploration": rows[:a], "validation": rows[a:b], "holdout": rows[b:]}


def _interval_minutes(interval: str) -> int:
    text = str(interval).lower().strip()
    if text.endswith("m"):
        try:
            return max(1, int(text[:-1]))
        except Exception:
            return 5
    if text.endswith("h"):
        try:
            return max(1, int(text[:-1])) * 60
        except Exception:
            return 60
    return 5


def _horizon_bars(horizon: str, interval: str) -> int:
    h = str(horizon).lower().strip()
    base = _interval_minutes(interval)
    if h.endswith("m"):
        minutes = int(h[:-1])
    elif h.endswith("h"):
        minutes = int(h[:-1]) * 60
    elif h.endswith("d"):
        minutes = int(h[:-1]) * 1440
    else:
        minutes = base
    return max(1, int(round(minutes / base)))


class ResearchExperimentEngine:
    def __init__(self, lake: DataLake, metric_lake: MetricLake, lab: LabStore, machine: StrategyMachine) -> None:
        self.lake = lake
        self.metric_lake = metric_lake
        self.lab = lab
        self.machine = machine
    def _result(self, project: ResearchProject, canonical_id: str, interval: str, **kwargs: Any) -> ResearchRunResult:
        return ResearchRunResult(
            run_id=f"RR-{uuid4().hex[:10].upper()}",
            research_id=project.id,
            canonical_id=canonical_id,
            family=str(project.event.get("family") or "generic"),
            interval=interval,
            generated_at_ms=int(time.time() * 1000),
            **kwargs,
        )

    def _coverage(self, canonical_id: str, interval: str) -> dict[str, Any]:
        bounds = self.lake.candle_bounds(canonical_id, interval)
        oi = self.metric_lake.bounds(canonical_id, "open_interest")
        return {
            "candle_rows": int(bounds.get("rows") or 0),
            "candle_first_ms": bounds.get("first_ms"),
            "candle_last_ms": bounds.get("last_ms"),
            "open_interest_points": int(oi.get("rows") or 0),
            "open_interest_first_ms": oi.get("first_ms"),
            "open_interest_last_ms": oi.get("last_ms"),
            "need_history": int(bounds.get("rows") or 0) < 250,
            "need_open_interest": False,
        }

    def run(self, project: ResearchProject, canonical_id: str) -> ResearchRunResult:
        interval = "10m" if canonical_id.startswith("moex:") else "5m"
        family = str(project.event.get("family") or "")
        if family == "round_level":
            return self._round_levels(project, canonical_id, interval)
        if family == "price_oi_divergence":
            return self._price_oi(project, canonical_id, interval)
        if family == "expiry":
            coverage = self._coverage(canonical_id, interval)
            coverage["need_expiry_metadata"] = True
            return self._result(
                project, canonical_id, interval, status="insufficient_data", coverage=coverage,
                conclusion="Expiry study is registered but contract-expiry metadata is not yet complete for this instrument.",
                next_action="Backfill versioned contract metadata, current/next contract history, OI and basis before testing.",
                warnings=["No hardcoded expiry dates are used."],
            )
        return self._result(
            project, canonical_id, interval, status="insufficient_data",
            coverage=self._coverage(canonical_id, interval),
            conclusion=f"Experiment family '{family or 'generic'}' has no deterministic runner yet.",
            next_action="Define an event detector and matched control for this research family.",
        )
    def _round_levels(self, project: ResearchProject, canonical_id: str, interval: str) -> ResearchRunResult:
        frame = self.lake.read_candles(canonical_id, interval)
        coverage = self._coverage(canonical_id, interval)
        if frame.is_empty() or frame.height < 250:
            return self._result(
                project, canonical_id, interval, status="insufficient_data", coverage=coverage,
                conclusion="Not enough candle history for round-level event study.",
                next_action="Backfill candle history and rerun automatically.",
            )
        strategy_id = "TQS-STRAT-ROUND-BUFFER-CRYPTO-001" if interval == "5m" else "TQS-STRAT-ROUND-BUFFER-001"
        spec = self.lab.get_strategy(strategy_id)
        if spec is None:
            return self._result(
                project, canonical_id, interval, status="insufficient_data", coverage=coverage,
                conclusion="Linked StrategySpec is missing.",
                next_action=f"Restore StrategySpec {strategy_id}.",
            )
        run = self.machine.run(spec, canonical_id, frame)
        self.lab.save_strategy_run(run)
        hold = (run.splits or {}).get("holdout") or {}
        excess = hold.get("median_excess_pct")
        conclusion = (
            f"Holdout median excess vs shifted controls: {excess:+.4f}%."
            if isinstance(excess, (int, float)) else
            "Holdout evidence is not yet sufficient for a directional conclusion."
        )
        return self._result(
            project, canonical_id, interval, status=run.status,
            sample_count=run.round_events, control_count=run.control_events,
            coverage=coverage, metrics=run.metrics, splits=run.splits,
            regimes=run.diagnostics, conclusion=conclusion,
            next_action="Replicate across instruments/regimes before promotion." if run.status == "candidate"
                        else "Keep as exploratory/negative evidence; do not convert directly to a live rule.",
            strategy_id=strategy_id, warnings=list(run.warnings),
        )
    def _price_oi(self, project: ResearchProject, canonical_id: str, interval: str) -> ResearchRunResult:
        frame = self.lake.read_candles(canonical_id, interval)
        coverage = self._coverage(canonical_id, interval)
        if frame.is_empty() or frame.height < 250:
            return self._result(
                project, canonical_id, interval, status="insufficient_data", coverage=coverage,
                conclusion="Not enough candle history for price/OI divergence.",
                next_action="Backfill candle history and rerun automatically.",
            )
        oi_rows = self.metric_lake.read(canonical_id, "open_interest", max_points=200_000)
        if len(oi_rows) < 30:
            coverage["need_open_interest"] = True
            return self._result(
                project, canonical_id, interval, status="insufficient_data", coverage=coverage,
                conclusion="Open-interest history is missing or too short.",
                next_action="Backfill official OI history and rerun automatically.",
            )
        candles = frame.select([c for c in ["ts_ms","open","high","low","close","volume","turnover"] if c in frame.columns]).sort("ts_ms")
        oi = pl.DataFrame([{"ts_ms": int(x["ts_ms"]), "oi": float(x["value"])} for x in oi_rows]).sort("ts_ms")
        tolerance = _interval_minutes(interval) * 60_000 * 3
        merged = candles.join_asof(oi, on="ts_ms", strategy="backward", tolerance=tolerance).drop_nulls(["close","oi"])
        rows = merged.to_dicts()
        if len(rows) < 250:
            coverage["aligned_rows"] = len(rows)
            return self._result(
                project, canonical_id, interval, status="insufficient_data", coverage=coverage,
                conclusion="Price and OI histories do not overlap enough after time alignment.",
                next_action="Extend OI coverage for the candle-history period.",
            )
        cfg = project.event or {}
        lookback = int(cfg.get("lookback_bars") or 3)
        max_price_bps = float(cfg.get("price_abs_return_max_bps") or 20)
        percentile = cfg.get("oi_change_percentile")
        fixed_min = float(cfg.get("oi_change_min_pct") or 0.0)
        reset = int(cfg.get("reset_bars") or 3)
        horizons = [h for h in project.horizons if h not in {"session"}]
        horizon_map = {h: _horizon_bars(h, interval) for h in horizons}
        max_h = max(horizon_map.values(), default=1)
        candidates: list[tuple[int,float,float]] = []
        for i in range(max(lookback, 12), len(rows) - max_h - 1):
            c0=float(rows[i-lookback]["close"]); c1=float(rows[i]["close"])
            o0=float(rows[i-lookback]["oi"]); o1=float(rows[i]["oi"])
            if c0 <= 0 or o0 <= 0: continue
            candidates.append((i,(c1/c0-1)*10_000,(o1/o0-1)*100))
        exploration_cut=int(len(rows)*.60)
        training_oi=[oi_pct for i,price_bps,oi_pct in candidates
                     if i < exploration_cut and abs(price_bps) <= max_price_bps and oi_pct > 0]
        if percentile is not None and training_oi:
            oi_threshold=float(_percentile(training_oi,float(percentile)) or 0.0)
            threshold_source=f"exploration_percentile_{float(percentile):.2f}"
        else:
            oi_threshold=fixed_min
            threshold_source="fixed_pct"
        training_abs=[abs(oi_pct) for i,price_bps,oi_pct in candidates
                      if i < exploration_cut and abs(price_bps) <= max_price_bps]
        control_threshold=float(_percentile(training_abs,.25) or max(.01,oi_threshold*.25))
        events: list[int]=[]; controls: list[int]=[]; last=-10_000
        for i,price_bps,oi_pct in candidates:
            if abs(price_bps) > max_price_bps: continue
            if oi_pct >= oi_threshold and oi_threshold > 0 and i-last >= reset:
                events.append(i); last=i
            elif abs(oi_pct) <= control_threshold:
                controls.append(i)
        if events and len(controls) > len(events)*3:
            step=max(1,len(controls)//(len(events)*3))
            controls=controls[::step][:len(events)*3]

        def evaluate(indices: list[int]) -> dict[str, Any]:
            out: dict[str, Any] = {}
            for h, bars in horizon_map.items():
                signed = [((float(rows[i+bars]["close"]) / float(rows[i]["close"])) - 1) * 100 for i in indices]
                out[h] = {"signed_pct": _dist(signed), "absolute_pct": _dist([abs(x) for x in signed])}
            return out

        es = _split(events); cs = _split(controls)
        splits = {name: {"event": evaluate(es[name]), "control": evaluate(cs[name])} for name in ("exploration","validation","holdout")}
        primary = "1h" if "1h" in horizon_map else (next(iter(horizon_map)) if horizon_map else None)
        min_events = int((project.validation or {}).get("min_events") or 40)
        status = "inconclusive"
        conclusion = "No primary horizon was configured."
        if len(events) < min_events:
            status = "insufficient_data"
            conclusion = f"Only {len(events)} events; minimum configured sample is {min_events}."
        elif primary:
            ve = splits["validation"]["event"].get(primary,{}).get("absolute_pct",{}).get("median")
            vc = splits["validation"]["control"].get(primary,{}).get("absolute_pct",{}).get("median")
            he = splits["holdout"]["event"].get(primary,{}).get("absolute_pct",{}).get("median")
            hc = splits["holdout"]["control"].get(primary,{}).get("absolute_pct",{}).get("median")
            if None not in (ve,vc,he,hc):
                vex = float(ve) - float(vc); hexcess = float(he) - float(hc)
                conclusion = f"{primary} absolute-move excess: validation {vex:+.4f} pp; holdout {hexcess:+.4f} pp."
                if vex > 0 and hexcess > 0:
                    status = "candidate"
                elif hexcess <= 0:
                    status = "rejected"

        regime_groups: dict[str, list[float]] = {}
        for i in events:
            if i < 12 or i + horizon_map.get(primary or "", 1) >= len(rows):
                continue
            pre = float(rows[i]["close"]) / float(rows[i-12]["close"]) - 1
            trend = "trend_up" if pre > .002 else "trend_down" if pre < -.002 else "range"
            hour = (int(rows[i]["ts_ms"]) // 3_600_000) % 24
            session = "utc_00_07" if hour < 8 else "utc_08_15" if hour < 16 else "utc_16_23"
            bars = horizon_map.get(primary or "", 1)
            ret = (float(rows[i+bars]["close"]) / float(rows[i]["close"]) - 1) * 100
            for key in (trend, session):
                regime_groups.setdefault(key, []).append(ret)
        regimes = {k: {"signed_pct": _dist(v), "absolute_pct": _dist([abs(x) for x in v])} for k,v in regime_groups.items()}
        coverage["aligned_rows"] = len(rows)
        coverage["event_count"] = len(events)
        coverage["control_count"] = len(controls)
        return self._result(
            project, canonical_id, interval, status=status,
            sample_count=len(events), control_count=len(controls), coverage=coverage,
            metrics={"all_event": evaluate(events), "all_control": evaluate(controls), "primary_horizon": primary,
                     "event_definition":{"price_abs_return_max_bps":max_price_bps,
                                         "oi_threshold_pct":oi_threshold,
                                         "oi_threshold_source":threshold_source,
                                         "control_abs_oi_threshold_pct":control_threshold,
                                         "lookback_bars":lookback}},
            splits=splits, regimes=regimes, conclusion=conclusion,
            next_action="Replicate on other instruments and then formalize a StrategySpec." if status == "candidate"
                        else "Preserve the negative/inconclusive result; test only preregistered refinements.",
            warnings=["Aggregate OI does not identify long-vs-short direction."],
        )
