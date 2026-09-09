import asyncio
import json
import time
from dataclasses import dataclass
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .errors import BitgetEnvironmentBlockedError, BitgetHttpError, BitgetNetworkError, BitgetTimeoutError, BitgetProtocolError

@dataclass(frozen=True)
class BitgetHttpResponse:
    data: object
    request_time_ms: int | None
    received_at_ms: int
    latency_ms: int

class BitgetPublicHttpTransport(Protocol):
    async def get(self, path: str, params: dict[str, str]) -> BitgetHttpResponse: ...

class StdlibBitgetPublicHttpTransport:
    def __init__(self, base_url: str = "https://api.bitget.com", timeout: float = 12.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    async def get(self, path: str, params: dict[str, str]) -> BitgetHttpResponse:
        return await asyncio.to_thread(self._get_sync, path, params)

    def _get_sync(self, path: str, params: dict[str, str]) -> BitgetHttpResponse:
        started = time.monotonic()
        request = Request(f"{self.base_url}{path}?{urlencode(params)}", headers={"Accept": "application/json"}, method="GET")
        try:
            with urlopen(request, timeout=self.timeout) as response:
                raw = response.read()
        except HTTPError as error:
            if error.code in (403, 451): raise BitgetEnvironmentBlockedError(error.code) from error
            raise BitgetHttpError(error.code) from error
        except TimeoutError as error: raise BitgetTimeoutError("Bitget request timed out") from error
        except URLError as error: raise BitgetNetworkError("Bitget network request failed") from error
        except OSError as error: raise BitgetNetworkError("Bitget network request failed") from error
        try: payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error: raise BitgetProtocolError("Bitget returned invalid JSON") from error
        received = int(time.time() * 1000)
        request_time = payload.get("requestTime") if isinstance(payload, dict) else None
        return BitgetHttpResponse(payload, request_time, received, int((time.monotonic() - started) * 1000))
