from tqs_intelligence.instrument_lab import economic_key


def test_crypto_economic_keys_join_across_venues():
    assert economic_key("BTCUSDT", "binance", "usdt-futures") == "BTC"
    assert economic_key("BTC-USDT-SWAP", "okx", "swap") == "BTC"
    assert economic_key("ETHUSDC", "bybit", "linear") == "ETH"


def test_moex_future_contract_root_is_preserved():
    assert economic_key("BRU6", "moex", "forts") == "BR"
    assert economic_key("SIH7", "moex", "future") == "SI"


def test_non_derivative_symbol_is_not_destroyed():
    assert economic_key("SBER", "moex", "shares") == "SBER"
