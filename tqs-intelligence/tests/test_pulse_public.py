from tqs_intelligence.pulse_public import PulsePublicStore, parse_pulse_html


def test_parse_pulse_profile_and_hidden_size_trade():
    html = """
    <html><body>
      <script type="application/json" id="__TRAMVAI_CHILD_STATE__">
      {
        "store": {
          "profile": {"nickname":"TraderRU","followersCount":1234,"postsCount":42},
          "operations": [
            {"id":"op1","ticker":"SBER","operationType":"BUY","operationDate":"2026-09-18T07:15:00Z","price":301.25},
            {"id":"op2","ticker":"GAZP","operationType":"SELL","operationDate":"2026-09-18T08:20:00Z","price":94.10}
          ]
        }
      }
      </script>
    </body></html>
    """
    parsed = parse_pulse_html("trader_ru", html)
    assert parsed["profile"]["followers"] == 1234
    assert parsed["profile"]["display_name"] == "TraderRU"
    assert len(parsed["events"]) == 2
    sber = next(x for x in parsed["events"] if x["symbol"] == "SBER")
    assert sber["side"] == "buy"
    assert sber["price"] == 301.25
    assert sber["size_known"] is False
    assert sber["quantity"] is None


def test_pulse_store_keeps_quantity_unknown(tmp_path):
    store = PulsePublicStore(str(tmp_path / "pulse.sqlite3"))
    store.track("trader_ru")
    parsed = {
        "profile": {"handle":"trader_ru","display_name":"Trader","followers":100,"posts_count":5,"raw":{}},
        "events": [{
            "event_id":"e1","handle":"trader_ru","ts_ms":1000,"symbol":"SBER","side":"buy",
            "price":300.0,"size_known":False,"quantity":None,"raw":{}
        }],
    }
    result = store.save("trader_ru", parsed, 2000)
    assert result["events_added"] == 1
    rows = store.events("SBER")
    assert rows[0]["size_known"] == 0
    assert rows[0]["quantity"] is None
