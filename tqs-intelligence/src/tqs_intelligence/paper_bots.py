from __future__ import annotations

import asyncio
import time
from typing import Any, Callable
from uuid import uuid4

from .lab_store import LabStore
from .strategy_models import PaperBot, PaperSignal, PaperTrade


def _now_ms() -> int:
    return int(time.time() * 1000)


def _interval_minutes(text: str) -> int:
    raw=str(text or "5m").lower().strip()
    if raw.endswith("m"):
        try: return max(1,int(raw[:-1]))
        except Exception: return 5
    if raw.endswith("h"):
        try: return max(1,int(raw[:-1]))*60
        except Exception: return 60
    return 5


class PaperBotService:
    """Paper-only strategy executor.

    It can never place exchange orders. A bot is created from one immutable
    StrategyRunResult and may be armed only when that run is candidate/validated.
    """

    SUPPORTED={"round_buffer_bounce","buy_dip_grid"}

    def __init__(self, lab: LabStore, snapshot_getter: Callable[[], Any], poll_seconds: int = 5) -> None:
        self.lab=lab
        self.snapshot_getter=snapshot_getter
        self.poll_seconds=max(2,int(poll_seconds))
        self._task: asyncio.Task|None=None
        self.running=False
        self.last_error: str|None=None
        self.last_eval_ms: int|None=None

    def create_from_run(self, run_id: str) -> PaperBot:
        run=self.lab.get_strategy_run(run_id)
        if run is None:
            raise KeyError(f"strategy run {run_id} not found")
        spec=self.lab.get_strategy(run.strategy_id)
        if spec is None:
            raise KeyError(f"strategy {run.strategy_id} not found")
        event_type=str(spec.event.get("type") or "")
        eligible=run.status in {"candidate","validated"}
        supported=event_type in self.SUPPORTED
        reason=""
        if not eligible:
            reason=f"StrategyRun status={run.status}; paper requires candidate/validated."
        elif not supported:
            reason=f"Paper evaluator for event type '{event_type}' is not implemented."
        selected=dict(run.metrics.get("selected") or {})
        if event_type=="round_buffer_bounce":
            selected.setdefault("spacing",run.metrics.get("selected_spacing"))
            selected.setdefault("buffer_bps",run.metrics.get("selected_buffer_bps"))
        now=_now_ms()
        bot=PaperBot(
            id=f"PB-{uuid4().hex[:10].upper()}",
            name=f"{spec.name_ru} / {run.canonical_id}",
            strategy_id=run.strategy_id,
            strategy_run_id=run.run_id,
            canonical_id=run.canonical_id,
            status="draft" if eligible and supported else "blocked",
            created_at_ms=now,updated_at_ms=now,
            config={
                "event_type":event_type,
                "interval":spec.interval,
                "event":dict(spec.event),
                "entry":dict(spec.entry),
                "exit":dict(spec.exit),
                "costs":dict(spec.costs),
                "selected":selected,
                "source_run_status":run.status,
            },
            state={"prev_price":None,"prices":[],"last_snapshot_ms":None},
            live_allowed=False,
            block_reason=reason,
        )
        return self.lab.save_paper_bot(bot)
    def set_status(self, bot_id: str, status: str) -> PaperBot:
        bot=self.lab.get_paper_bot(bot_id)
        if bot is None:
            raise KeyError(f"paper bot {bot_id} not found")
        target=str(status).lower()
        if target not in {"armed","paused","draft"}:
            raise ValueError("paper status must be armed, paused or draft")
        run=self.lab.get_strategy_run(bot.strategy_run_id)
        if target=="armed":
            if bot.block_reason:
                raise ValueError(bot.block_reason)
            if run is None or run.status not in {"candidate","validated"}:
                raise ValueError("source StrategyRun is no longer candidate/validated")
        bot.status=target
        return self.lab.save_paper_bot(bot)

    def status(self) -> dict[str,Any]:
        bots=self.lab.list_paper_bots(2000)
        trades=self.lab.list_paper_trades("", "", 5000)
        return {
            "running":self.running,
            "last_eval_ms":self.last_eval_ms,
            "last_error":self.last_error,
            "bots":len(bots),
            "armed":sum(1 for x in bots if x.status=="armed"),
            "blocked":sum(1 for x in bots if x.status=="blocked"),
            "open_trades":sum(1 for x in trades if x.status=="open"),
            "closed_trades":sum(1 for x in trades if x.status=="closed"),
            "mode":"paper",
            "live_order_capability":False,
        }

    def _signal(self, bot: PaperBot, ts_ms: int, kind: str, price: float, side: str="", reason: str="", **payload: Any) -> None:
        self.lab.append_paper_signal(PaperSignal(
            id=f"PS-{uuid4().hex[:12].upper()}",
            bot_id=bot.id,ts_ms=ts_ms,canonical_id=bot.canonical_id,
            kind=kind,side=side,price=price,reason=reason,payload=payload,
        ))

    def _open_trade(self, bot: PaperBot, ts_ms: int, price: float, side: str, reason: str) -> None:
        if self.lab.list_paper_trades(bot.id,"open",1):
            return
        trade=PaperTrade(
            id=f"PT-{uuid4().hex[:12].upper()}",
            bot_id=bot.id,canonical_id=bot.canonical_id,status="open",
            side=side,entry_ts_ms=ts_ms,entry_price=price,
            payload={"entry_reason":reason,"strategy_run_id":bot.strategy_run_id},
        )
        self.lab.save_paper_trade(trade)
        self._signal(bot,ts_ms,"entry",price,side,reason,trade_id=trade.id)

    def _close_trade(self, bot: PaperBot, trade: PaperTrade, ts_ms: int, price: float, reason: str) -> None:
        sign=1.0 if trade.side=="long" else -1.0
        gross=sign*(price/trade.entry_price-1)*100
        cost_bps=float((bot.config.get("costs") or {}).get("round_trip_bps") or 0)
        trade.status="closed"; trade.exit_ts_ms=ts_ms; trade.exit_price=price
        trade.pnl_pct=gross-cost_bps/100; trade.exit_reason=reason
        self.lab.save_paper_trade(trade)
        self._signal(bot,ts_ms,"exit",price,trade.side,reason,trade_id=trade.id,pnl_pct=trade.pnl_pct)

    def _manage_open_trade(self, bot: PaperBot, ts_ms: int, price: float) -> bool:
        rows=self.lab.list_paper_trades(bot.id,"open",1)
        if not rows:
            return False
        trade=rows[0]
        cfg=bot.config; selected=cfg.get("selected") or {}; event_type=cfg.get("event_type")
        if event_type=="buy_dip_grid":
            mode=str(selected.get("mode") or "bps")
            target=float(selected.get("target") or 0); stop=float(selected.get("stop") or 0)
            if mode=="points":
                target_px=trade.entry_price+target; stop_px=trade.entry_price-stop
            else:
                target_px=trade.entry_price*(1+target/10000); stop_px=trade.entry_price*(1-stop/10000)
            if price<=stop_px:
                self._close_trade(bot,trade,ts_ms,price,"stop"); return True
            if price>=target_px:
                self._close_trade(bot,trade,ts_ms,price,"target"); return True
            hold=int(selected.get("max_hold_bars") or 1)
        else:
            hold=int((cfg.get("exit") or {}).get("horizon_bars") or 1)
        hold_ms=hold*_interval_minutes(str(cfg.get("interval") or "5m"))*60_000
        if ts_ms-trade.entry_ts_ms>=hold_ms:
            self._close_trade(bot,trade,ts_ms,price,"time"); return True
        return True
    def _eval_round(self, bot: PaperBot, ts_ms: int, price: float) -> None:
        state=dict(bot.state or {}); selected=bot.config.get("selected") or {}
        spacing=float(selected.get("spacing") or 0); buffer_bps=float(selected.get("buffer_bps") or 0)
        if spacing<=0 or buffer_bps<=0:
            bot.status="blocked"; bot.block_reason="StrategyRun has no frozen spacing/buffer parameters."
            self.lab.save_paper_bot(bot); return
        level=round(price/spacing)*spacing
        if level<=0: return
        dist=abs(price/level-1)*10_000
        prev=state.get("prev_price")
        touch=state.get("touch") or {}
        stale_ms=3*_interval_minutes(str(bot.config.get("interval") or "5m"))*60_000
        if touch and ts_ms-int(touch.get("ts_ms") or 0)>stale_ms:
            touch={}
        if touch:
            tlevel=float(touch.get("level") or level); approach=str(touch.get("approach") or "")
            band=buffer_bps/10_000
            if approach=="above" and price>tlevel*(1+band):
                self._open_trade(bot,ts_ms,price,"long","round-level rejection from above")
                touch={}
            elif approach=="below" and price<tlevel*(1-band):
                self._open_trade(bot,ts_ms,price,"short","round-level rejection from below")
                touch={}
        elif dist<=buffer_bps and isinstance(prev,(int,float)):
            approach="above" if float(prev)>level else "below" if float(prev)<level else ""
            if approach:
                touch={"level":level,"approach":approach,"ts_ms":ts_ms}
                self._signal(bot,ts_ms,"setup",price,"",f"round touch {level:g}",level=level,distance_bps=dist)
        state["touch"]=touch; state["prev_price"]=price; state["last_snapshot_ms"]=ts_ms
        bot.state=state; self.lab.save_paper_bot(bot)

    def _eval_dip(self, bot: PaperBot, ts_ms: int, price: float) -> None:
        state=dict(bot.state or {}); selected=bot.config.get("selected") or {}; event=bot.config.get("event") or {}
        prices=[float(x) for x in (state.get("prices") or []) if isinstance(x,(int,float))]
        lookback=max(2,int(event.get("lookback_bars") or 12))
        prices.append(price); prices=prices[-(lookback+1):]
        if len(prices)>lookback:
            reference=max(prices[:-1]); drop=float(selected.get("drop_pct") or 0)
            trigger=reference*(1-drop/100) if drop>0 else None
            last_entry=int(state.get("last_entry_ms") or 0)
            reset_ms=int(event.get("reset_bars") or 3)*_interval_minutes(str(bot.config.get("interval") or "5m"))*60_000
            if trigger and price<=trigger and ts_ms-last_entry>=reset_ms and not self.lab.list_paper_trades(bot.id,"open",1):
                self._open_trade(bot,ts_ms,price,"long",f"dip {drop:g}% from rolling high")
                state["last_entry_ms"]=ts_ms
        state["prices"]=prices; state["prev_price"]=price; state["last_snapshot_ms"]=ts_ms
        bot.state=state; self.lab.save_paper_bot(bot)

    def evaluate_snapshot(self, snapshot: Any) -> int:
        if snapshot is None:
            return 0
        ts_ms=int(getattr(snapshot,"generated_at_ms",0) or _now_ms())
        quotes={getattr(q,"canonical_id",""):q for q in (getattr(snapshot,"quotes",[]) or [])}
        count=0
        for bot in self.lab.list_paper_bots(1000):
            if bot.status!="armed": continue
            quote=quotes.get(bot.canonical_id)
            price=getattr(quote,"last",None) if quote is not None else None
            if price in (None,0):
                continue
            price=float(price); count+=1
            if self._manage_open_trade(bot,ts_ms,price):
                bot.state={**(bot.state or {}),"prev_price":price,"last_snapshot_ms":ts_ms}
                self.lab.save_paper_bot(bot); continue
            event_type=str(bot.config.get("event_type") or "")
            if event_type=="round_buffer_bounce":
                self._eval_round(bot,ts_ms,price)
            elif event_type=="buy_dip_grid":
                self._eval_dip(bot,ts_ms,price)
        self.last_eval_ms=ts_ms
        return count

    async def _loop(self) -> None:
        self.running=True
        try:
            while True:
                try:
                    self.evaluate_snapshot(self.snapshot_getter())
                    self.last_error=None
                except Exception as exc:
                    self.last_error=f"{type(exc).__name__}: {str(exc)[:500]}"
                await asyncio.sleep(self.poll_seconds)
        finally:
            self.running=False

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task=asyncio.create_task(self._loop(),name="tqs-paper-bots")

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try: await self._task
            except asyncio.CancelledError: pass
