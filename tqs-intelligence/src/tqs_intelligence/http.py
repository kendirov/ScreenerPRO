from __future__ import annotations

import asyncio
from typing import Any

import httpx


class JsonHttp:
    def __init__(self, timeout_s: float = 10.0, concurrency: int = 8) -> None:
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout_s),
            follow_redirects=True,
            headers={"User-Agent": "TQS-Intelligence/0.1 (+market-research)"},
        )
        self._sem = asyncio.Semaphore(concurrency)

    async def get_json(self, url: str, params: dict[str, Any] | None = None) -> Any:
        async with self._sem:
            response = await self._client.get(url, params=params)
            response.raise_for_status()
            return response.json()

    async def get_text(self, url: str, params: dict[str, Any] | None = None) -> str:
        async with self._sem:
            response = await self._client.get(url, params=params)
            response.raise_for_status()
            return response.text

    async def aclose(self) -> None:
        await self._client.aclose()
