from __future__ import annotations

from typing import Any

from .models import AssetClass, Quote
from .sources import MoexSource, _f, _i, _now_ms


def _first_number(*values: Any) -> float | None:
    for value in values:
        parsed = _f(value)
        if parsed is not None:
            return parsed
    return None


def _pct_change(row: dict[str, Any], sec: dict[str, Any], last: float | None) -> tuple[float | None, str]:
    """Return a percentage only from explicitly percentage-valued MOEX fields or a price ratio.

    Generic CHANGE/LASTCHANGE fields are absolute points on some MOEX markets (notably indices),
    so treating them as percent corrupts anomaly history.
    """
    explicit = _first_number(row.get("LASTTOPREVPRICE"), row.get("LASTCHANGEPRCNT"), row.get("WAPRICECHANGEPRCNT"))
    if explicit is not None:
        return explicit, "explicit_pct"

    previous = _first_number(
        row.get("PREVPRICE"), row.get("PREVLEGALCLOSEPRICE"), row.get("PREVADMITTEDQUOTE"),
        sec.get("PREVPRICE"), sec.get("PREVLEGALCLOSEPRICE"), sec.get("PREVADMITTEDQUOTE"),
    )
    if last is not None and previous not in (None, 0):
        return (last / previous - 1.0) * 100.0, "derived_last_vs_prev"
    return None, "missing_pct"


class MoexSourceV04(MoexSource):
    """MOEX adapter with strict percentage semantics and richer research metadata."""

    name = "MOEX ISS / quality-safe"
    data_fields = (
        "цена", "bid/ask", "изменение %", "объём/оборот", "NUMTRADES", "OI FORTS",
        "open/prev/settle", "торговый статус", "свечи ISS", "quality/provenance",
    )

    async def _fetch_market(self, engine: str, market: str, asset_class: AssetClass, market_type: str) -> list[Quote]:
        payload = await self.http.get_json(
            f"{self.BASE}/{engine}/markets/{market}/securities.json",
            {"iss.meta": "off", "iss.only": "securities,marketdata"},
        )
        observed = _now_ms()
        securities = {str(x.get("SECID")): x for x in self._section(payload, "securities") if x.get("SECID")}
        best: dict[str, Quote] = {}

        for row in self._section(payload, "marketdata"):
            symbol = str(row.get("SECID") or "")
            if not symbol:
                continue
            sec = securities.get(symbol, {})
            last = _first_number(row.get("LAST"), row.get("SETTLEPRICE"), row.get("MARKETPRICE"), row.get("CURRENTVALUE"))
            pct, pct_source = _pct_change(row, sec, last)
            turnover = _first_number(row.get("VALTODAY"), row.get("VALTODAY_RUR"), row.get("VALUE"))
            previous = _first_number(
                row.get("PREVPRICE"), row.get("PREVLEGALCLOSEPRICE"), row.get("PREVADMITTEDQUOTE"),
                sec.get("PREVPRICE"), sec.get("PREVLEGALCLOSEPRICE"), sec.get("PREVADMITTEDQUOTE"),
            )
            absolute_change = _first_number(row.get("CHANGE"), row.get("LASTCHANGE"))
            open_price = _first_number(row.get("OPEN"), row.get("OPENPRICE"))
            settle_price = _first_number(row.get("SETTLEPRICE"), sec.get("SETTLEPRICE"))
            num_trades = _i(row.get("NUMTRADES"))

            quality_flags: list[str] = []
            if pct_source == "missing_pct":
                quality_flags.append("pct_missing")
            if last is None:
                quality_flags.append("price_missing")
            if row.get("TRADINGSTATUS") in (None, ""):
                quality_flags.append("trading_status_missing")

            quote = Quote(
                provider=self.provider,
                venue="MOEX",
                symbol=symbol,
                display_symbol=str(sec.get("SHORTNAME") or sec.get("SECNAME") or symbol),
                asset_class=asset_class,
                market_type=market_type,
                currency=str(sec.get("CURRENCYID") or "RUB"),
                last=last,
                bid=_first_number(row.get("BID"), row.get("BIDPRICE")),
                ask=_first_number(row.get("OFFER"), row.get("OFFERPRICE")),
                open_24h=open_price,
                high_24h=_f(row.get("HIGH")),
                low_24h=_f(row.get("LOW")),
                volume_24h=_first_number(row.get("VOLTODAY"), row.get("VOLUME")),
                turnover_24h=turnover,
                change_24h_pct=pct,
                open_interest=_f(row.get("OPENPOSITION")),
                ts_ms=observed,
                observed_at_ms=observed,
                meta={
                    "board": row.get("BOARDID"),
                    "trading_status": row.get("TRADINGSTATUS"),
                    "shortname": sec.get("SHORTNAME"),
                    "secname": sec.get("SECNAME"),
                    "type": sec.get("TYPE"),
                    "group": sec.get("GROUP"),
                    "engine": engine,
                    "market": market,
                    "num_trades": num_trades,
                    "prev_price": previous,
                    "open_price": open_price,
                    "settle_price": settle_price,
                    "absolute_change": absolute_change,
                    "pct_source": pct_source,
                    "quality_flags": quality_flags,
                    "expiry": sec.get("LASTTRADEDATE") or sec.get("MATDATE") or sec.get("LASTDELDATE"),
                    "short_name": sec.get("SHORTNAME"),
                    "lotsize": _i(sec.get("LOTSIZE")),
                    "minstep": _f(sec.get("MINSTEP")),
                },
            )
            old = best.get(symbol)
            if old is None or (quote.turnover_24h or -1) > (old.turnover_24h or -1):
                best[symbol] = quote

        return list(best.values())
