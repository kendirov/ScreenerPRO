from __future__ import annotations

import json
import re
import statistics
from typing import Any


_STABLE_QUOTES = ("USDT", "USDC", "BUSD", "FDUSD", "USD", "BTC", "ETH")
_MOEX_MONTH = set("FGHJKMNQUVXZ")


def economic_key(symbol: str, provider: str = "", market_type: str = "") -> str:
    raw = str(symbol or "").upper().strip()
    if not raw:
        return ""
    parts = [x for x in re.split(r"[-_/]", raw) if x]
    if provider == "okx" and parts:
        return parts[0]
    compact = "".join(ch for ch in raw if ch.isalnum())
    for suffix in ("PERPETUAL", "PERP", "SWAP"):
        if compact.endswith(suffix) and len(compact) > len(suffix):
            compact = compact[:-len(suffix)]
    for quote in _STABLE_QUOTES:
        if compact.endswith(quote) and len(compact) > len(quote) + 1:
            return compact[:-len(quote)]
    if provider == "moex" or "future" in str(market_type).lower() or market_type == "forts":
        m = re.match(r"^([A-ZА-Я]{1,8})([FGHJKMNQUVXZ])(\d{1,2})$", compact)
        if m and m.group(2) in _MOEX_MONTH:
            return m.group(1)
        m = re.match(r"^([A-ZА-Я]{1,8})\d", compact)
        if m:
            return m.group(1)
    return compact


def _series_span(rows: list[dict[str, Any]]) -> int:
    if len(rows) < 2:
        return len(rows)
    return max(0, int(rows[-1].get("ts_ms") or 0) - int(rows[0].get("ts_ms") or 0))


class InstrumentLab:
    """Universal trader-facing drill-down for one economic instrument.

    Venue identity is preserved. When a selected venue has no bulk candle history,
    a clearly-labelled Binance same-underlying context may provide the chart while
    live quote/anomaly/account evidence remains attached to the selected venue.
    """

    def __init__(self, store: Any, lake: Any, lab: Any, metric_lake: Any | None = None) -> None:
        self.store = store; self.lake = lake; self.lab = lab
        if metric_lake is None:
            from .metric_lake import MetricLake
            metric_lake = MetricLake(lake.root)
        self.metric_lake = metric_lake

    def search(self, query: str, snapshot: Any, limit: int = 40) -> list[dict[str, Any]]:
        needle = query.strip().lower()
        if not needle:
            return []
        out: list[dict[str, Any]] = []; seen: set[str] = set()
        for q in (snapshot.quotes if snapshot else []):
            hay = f"{q.symbol} {q.display_symbol or ''} {q.canonical_id} {q.venue}".lower()
            if needle in hay and q.canonical_id not in seen:
                item = q.model_dump(mode="json"); item["origin"] = "live"; out.append(item); seen.add(q.canonical_id)
                if len(out) >= limit:
                    return out
        like = f"%{needle}%"
        with self.store._lock:
            rows = self.store._con.execute(
                """select payload_json from (
                       select canonical_id,payload_json,row_number() over(partition by canonical_id order by observed_at_ms desc) rn
                       from quote_snapshots where lower(symbol) like ? or lower(canonical_id) like ?
                   ) where rn=1 limit ?""", [like, like, limit * 3]).fetchall()
        for (payload,) in rows:
            try: item = json.loads(payload or "{}")
            except Exception: continue
            cid = str(item.get("canonical_id") or "")
            if not cid:
                provider = str(item.get("provider") or ""); market_type = str(item.get("market_type") or ""); symbol = str(item.get("symbol") or "")
                cid = f"{provider}:{market_type}:{symbol}" if provider and symbol else ""; item["canonical_id"] = cid
            if cid and cid not in seen:
                item["origin"] = "history"; out.append(item); seen.add(cid)
            if len(out) >= limit: break
        return out

    def _latest_quote(self, canonical_id: str) -> dict[str, Any] | None:
        with self.store._lock:
            row = self.store._con.execute("select payload_json from quote_snapshots where canonical_id=? order by observed_at_ms desc limit 1", [canonical_id]).fetchone()
        if not row: return None
        try: return json.loads(row[0] or "{}")
        except Exception: return None

    def _live_series(self, canonical_id: str, limit: int = 6000) -> list[dict[str, Any]]:
        with self.store._lock:
            rows = self.store._con.execute(
                """select observed_at_ms,last,change_24h_pct,volume_24h,turnover_24h,open_interest,funding_rate
                   from quote_snapshots where canonical_id=? and last is not null order by observed_at_ms desc limit ?""",
                [canonical_id, limit]).fetchall()
        rows.reverse()
        return [{"ts_ms":int(r[0]),"price":float(r[1]),"change_24h_pct":float(r[2]) if r[2] is not None else None,
                 "volume_24h":float(r[3]) if r[3] is not None else None,"turnover_24h":float(r[4]) if r[4] is not None else None,
                 "open_interest":float(r[5]) if r[5] is not None else None,"funding_rate":float(r[6]) if r[6] is not None else None} for r in rows]

    def _scores(self, canonical_id: str, limit: int = 6000) -> list[dict[str, Any]]:
        with self.store._lock:
            rows = self.store._con.execute("""select observed_at_ms,score,severity,payload_json from anomaly_snapshots
                where canonical_id=? order by observed_at_ms desc limit ?""", [canonical_id,limit]).fetchall()
        rows.reverse(); out=[]
        for ts,score,severity,payload in rows:
            reasons=[]; signals=[]
            try:
                obj=json.loads(payload or "{}"); reasons=obj.get("reasons") or []; signals=obj.get("signals") or []
            except Exception: pass
            out.append({"ts_ms":int(ts),"score":float(score),"severity":str(severity),"reasons":reasons,"signals":signals})
        return out

    def _history(self, canonical_id: str, interval: str, max_points: int = 15000) -> list[dict[str, Any]]:
        frame=self.lake.read_candles(canonical_id,interval)
        if frame.is_empty(): return []
        if frame.height>max_points: frame=frame.tail(max_points)
        cols=[x for x in ["ts_ms","open","high","low","close","volume","turnover","source"] if x in frame.columns]
        return frame.select(cols).to_dicts()

    @staticmethod
    def _venue_context(quotes: list[Any], quote: dict[str, Any] | None) -> list[dict[str, Any]]:
        symbol=str((quote or {}).get("symbol") or ""); provider=str((quote or {}).get("provider") or ""); market_type=str((quote or {}).get("market_type") or "")
        key=economic_key(symbol,provider,market_type)
        if not key: return []
        matches=[]; prices=[]
        for item in quotes:
            if economic_key(item.symbol,item.provider,item.market_type)!=key: continue
            payload=item.model_dump(mode="json"); last=payload.get("last")
            if last not in (None,0): prices.append(float(last))
            matches.append(payload)
        median=statistics.median(prices) if prices else None
        for item in matches:
            last=item.get("last"); item["economic_key"]=key
            item["venue_deviation_bps"]=((float(last)/median-1)*10_000) if median and last not in (None,0) else None
        matches.sort(key=lambda x:(float(x.get("turnover_24h") or 0),abs(float(x.get("venue_deviation_bps") or 0))),reverse=True)
        return matches[:50]

    def _read_metric_set(self, canonical_id: str, names: tuple[str, ...]) -> dict[str, list[dict[str, Any]]]:
        out={}
        for name in names:
            rows=self.metric_lake.read(canonical_id,name,max_points=20_000)
            if rows: out[name]=rows
        return out

    def _metric_context(self, canonical_id: str, quote: dict[str, Any] | None, venue_context: list[dict[str, Any]]) -> tuple[dict[str,list[dict[str,Any]]],dict[str,dict[str,list[dict[str,Any]]]],dict[str,Any],list[dict[str,Any]]]:
        q=quote or {}; provider=str(q.get("provider") or ""); market_type=str(q.get("market_type") or ""); symbol=str(q.get("symbol") or ""); key=economic_key(symbol,provider,market_type)
        metrics:dict[str,list[dict[str,Any]]]={}; sources:dict[str,dict[str,list[dict[str,Any]]]]={}; participant:dict[str,Any]={}; backfills=[]
        binance=next((x for x in venue_context if x.get("provider")=="binance" and x.get("market_type")=="usdt-futures"),None)
        bybit=next((x for x in venue_context if x.get("provider")=="bybit" and x.get("market_type")=="linear"),None)
        if binance:
            cid=str(binance.get("canonical_id")); rows=self._read_metric_set(cid,("funding_rate","open_interest","open_interest_value","basis_rate","basis","annualized_basis_rate")); sources["binance"]=rows
            if not rows.get("funding_rate") or not rows.get("open_interest"): backfills.append({"provider":"binance","symbol":cid.rsplit(":",1)[-1],"start_ms":1609459200000})
            for name in ("open_interest_value","basis_rate","basis","annualized_basis_rate"):
                if rows.get(name): metrics[name]=rows[name]
        if bybit:
            cid=str(bybit.get("canonical_id")); rows=self._read_metric_set(cid,("funding_rate","open_interest")); sources["bybit"]=rows
            if not rows.get("funding_rate") or not rows.get("open_interest"): backfills.append({"provider":"bybit","symbol":cid.rsplit(":",1)[-1],"market_type":"linear","start_ms":1609459200000})
        for name in ("open_interest","funding_rate"):
            candidates=[rows[name] for rows in sources.values() if rows.get(name)]
            if candidates: metrics[name]=max(candidates,key=_series_span)
        if provider=="moex" and (market_type=="forts" or "future" in market_type):
            futoi_cid=f"moex:futoi:{key}"; names=("futoi_fiz_long_contracts","futoi_fiz_short_contracts","futoi_fiz_long_accounts","futoi_fiz_short_accounts","futoi_fiz_net_contracts","futoi_yur_long_contracts","futoi_yur_short_contracts","futoi_yur_long_accounts","futoi_yur_short_accounts","futoi_yur_net_contracts")
            rows=self._read_metric_set(futoi_cid,names); sources["moex_futoi"]=rows
            for name,series in rows.items(): metrics[name]=series; participant[name]=series[-1]
            if not rows.get("futoi_fiz_long_contracts"): backfills.append({"provider":"moex","symbol":key,"start_ms":1609459200000,"authorized":False})
        return metrics,sources,participant,backfills

    def build(self, canonical_id: str, snapshot: Any) -> dict[str, Any]:
        quotes=snapshot.quotes if snapshot else []; quote_obj=next((q for q in quotes if q.canonical_id==canonical_id),None)
        quote=quote_obj.model_dump(mode="json") if quote_obj is not None else self._latest_quote(canonical_id); live=self._live_series(canonical_id)
        symbol=str((quote or {}).get("symbol") or (canonical_id.rsplit(":",1)[-1] if ":" in canonical_id else canonical_id)); provider=str((quote or {}).get("provider") or (canonical_id.split(":",1)[0] if ":" in canonical_id else "")); market_type=str((quote or {}).get("market_type") or (canonical_id.split(":",2)[1] if canonical_id.count(":")>=2 else "")); key=economic_key(symbol,provider,market_type)
        venue_context=self._venue_context(quotes,quote); related=[x for x in venue_context if x.get("canonical_id")!=canonical_id][:30]
        interval="10m" if provider=="moex" else "5m"; price_history_cid=canonical_id; price_history_provider=provider; candles=self._history(price_history_cid,interval)
        if not candles and provider!="moex":
            fallback=next((x for x in venue_context if x.get("provider")=="binance" and x.get("market_type") in {"usdt-futures","spot"}),None)
            if fallback:
                price_history_cid=str(fallback.get("canonical_id")); price_history_provider="binance"; candles=self._history(price_history_cid,"5m"); interval="5m"
        episodes=[x for x in self.store.list_episodes(limit=1000,q=symbol) if x.canonical_id==canonical_id][:200]; episode_rows=[]
        for ep in episodes:
            try: outcome=self.store.episode_outcome(ep.id).model_dump(mode="json")
            except Exception: outcome=None
            episode_rows.append({"episode":ep.model_dump(mode="json"),"outcome":outcome})
        scores=self._scores(canonical_id); news=[]
        if snapshot:
            for item in snapshot.news:
                if key and key in {economic_key(x) for x in item.symbols}: news.append(item.model_dump(mode="json"))
        runs=[]
        for run in self.lab.list_strategy_runs(limit=2000):
            if run.canonical_id==canonical_id:
                runs.append(run.model_dump(mode="json"))
                if len(runs)>=50: break
        metrics,metric_sources,participant_context,metric_backfills=self._metric_context(canonical_id,quote,venue_context); latest=live[-1] if live else None
        historical_oi=metrics.get("open_interest") or []; historical_funding=metrics.get("funding_rate") or []; participant_points=sum(len(v) for k,v in metrics.items() if k.startswith("futoi_"))
        coverage={"live_snapshots":len(live),"historical_candles":len(candles),"history_from_ms":int(candles[0]["ts_ms"]) if candles else None,"history_to_ms":int(candles[-1]["ts_ms"]) if candles else None,"price_history_canonical_id":price_history_cid,"price_history_provider":price_history_provider,"price_history_is_fallback":price_history_cid!=canonical_id,"anomaly_points":len(scores),"episodes":len(episode_rows),"news":len(news),"strategy_runs":len(runs),"venue_matches":len(venue_context),"historical_oi_points":len(historical_oi),"historical_funding_points":len(historical_funding),"participant_metric_points":participant_points,"metric_sources":{k:{m:len(v) for m,v in rows.items()} for k,rows in metric_sources.items()},"has_oi":bool(historical_oi) or any(x.get("open_interest") is not None for x in live[-1000:]),"has_funding":bool(historical_funding) or any(x.get("funding_rate") is not None for x in live[-1000:]),"has_futoi":participant_points>0}
        backfill=None
        if provider in {"moex","binance"}: backfill={"provider":provider,"symbol":symbol,"market_type":market_type or ("shares" if provider=="moex" else "usdt-futures"),"interval":interval}
        elif price_history_provider=="binance" and not candles:
            fq=next((x for x in venue_context if x.get("canonical_id")==price_history_cid),None)
            if fq: backfill={"provider":"binance","symbol":fq.get("symbol"),"market_type":fq.get("market_type") or "usdt-futures","interval":"5m"}
        return {"canonical_id":canonical_id,"economic_key":key,"quote":quote,"latest_live":latest,"coverage":coverage,"interval":interval,"price_history_source":{"canonical_id":price_history_cid,"provider":price_history_provider,"fallback":price_history_cid!=canonical_id},"candles":candles,"live":live,"metrics":metrics,"metric_sources":metric_sources,"participant_context":participant_context,"scores":scores,"episodes":episode_rows,"news":news[:100],"strategy_runs":runs,"venue_context":venue_context,"related":related,"suggested_backfill":backfill,"suggested_metrics_backfill":metric_backfills[0] if metric_backfills else None,"suggested_metric_backfills":metric_backfills}
