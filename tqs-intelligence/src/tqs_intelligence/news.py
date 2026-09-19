from __future__ import annotations

import asyncio
import calendar
import time
from email.utils import parsedate_to_datetime
from typing import Iterable
from urllib.parse import urlparse

import feedparser

from .http import JsonHttp
from .models import NewsItem


SYMBOL_TERMS = {
    "BTC": ("bitcoin", "btc"), "ETH": ("ethereum", "ether", "eth"), "SOL": ("solana", "sol"),
    "SBER": ("сбер", "sberbank", "sber"), "GAZP": ("газпром", "gazprom", "gazp"),
    "LKOH": ("лукойл", "lukoil", "lkoh"), "YDEX": ("яндекс", "yandex"),
    "Si": ("ruble", "рубл", "usd/rub", "dollar ruble"), "BR": ("brent", "oil", "нефт"),
}


def _tags(text: str) -> tuple[list[str], list[str]]:
    value = text.lower()
    symbols = [symbol for symbol, terms in SYMBOL_TERMS.items() if any(term in value for term in terms)]
    themes: list[str] = []
    for theme, terms in {
        "rates": ("rate", "ставк", "central bank", "цб", "fed"),
        "sanctions": ("sanction", "санкц"),
        "energy": ("oil", "brent", "gas", "нефт", "газ"),
        "crypto": ("bitcoin", "ethereum", "crypto", "биткоин", "крипт"),
        "exchange": ("listing", "delisting", "листинг", "делистинг"),
    }.items():
        if any(term in value for term in terms): themes.append(theme)
    return symbols, themes


class NewsCollector:
    def __init__(self, http: JsonHttp, rss_urls: Iterable[str] = ()) -> None:
        self.http = http
        self.rss_urls = [url for url in rss_urls if url]

    async def _gdelt(self, limit: int = 50) -> list[NewsItem]:
        query = '(bitcoin OR ethereum OR cryptocurrency OR "Moscow Exchange" OR MOEX OR ruble OR Brent)'
        payload = await self.http.get_json("https://api.gdeltproject.org/api/v2/doc/doc", {
            "query": query, "mode": "ArtList", "maxrecords": str(limit), "format": "json", "sort": "HybridRel",
        })
        result: list[NewsItem] = []
        for row in payload.get("articles") or []:
            title = str(row.get("title") or "").strip(); url = str(row.get("url") or "").strip()
            if not title or not url: continue
            symbols, themes = _tags(title); seen = row.get("seendate"); published = None
            if isinstance(seen, str) and len(seen) >= 14:
                try: published = calendar.timegm(time.strptime(seen[:14], "%Y%m%d%H%M%S")) * 1000
                except ValueError: pass
            result.append(NewsItem(source=str(row.get("domain") or "GDELT"), title=title, url=url,
                published_at_ms=published, language=row.get("language"), symbols=symbols, themes=themes))
        return result

    async def _rss(self, url: str) -> list[NewsItem]:
        text = await self.http.get_text(url); feed = feedparser.loads(text); source = feed.feed.get("title") or urlparse(url).netloc or "RSS"
        result: list[NewsItem] = []
        for entry in feed.entries[:100]:
            title = str(entry.get("title") or "").strip(); link = str(entry.get("link") or "").strip()
            if not title or not link: continue
            symbols, themes = _tags(title + " " + str(entry.get("summary") or "")); published = None
            for key in ("published", "updated"):
                raw = entry.get(key)
                if raw:
                    try: published = int(parsedate_to_datetime(raw).timestamp() * 1000)
                    except (TypeError, ValueError, OverflowError): pass
                    break
            result.append(NewsItem(source=str(source), title=title, url=link, published_at_ms=published, symbols=symbols, themes=themes))
        return result

    async def collect(self) -> list[NewsItem]:
        tasks = [self._gdelt()] + [self._rss(url) for url in self.rss_urls]
        rows = await asyncio.gather(*tasks, return_exceptions=True); result: list[NewsItem] = []; seen_urls: set[str] = set()
        for chunk in rows:
            if isinstance(chunk, BaseException): continue
            for item in chunk:
                if item.url not in seen_urls:
                    seen_urls.add(item.url); result.append(item)
        return sorted(result, key=lambda item: item.published_at_ms or 0, reverse=True)[:200]
