class BitgetPublicError(Exception):
    """Base error for the unauthenticated Bitget public boundary."""

class BitgetNetworkError(BitgetPublicError): pass
class BitgetTimeoutError(BitgetPublicError): pass
class BitgetHttpError(BitgetPublicError):
    def __init__(self, status_code: int):
        self.status_code = status_code
        super().__init__(f"Bitget HTTP error {status_code}")
class BitgetEnvironmentBlockedError(BitgetHttpError): pass
class BitgetApiError(BitgetPublicError): pass
class BitgetProtocolError(BitgetPublicError): pass
class UnsupportedMarketCapability(BitgetPublicError): pass
