from pathlib import Path


def test_runtime_audit_uses_quick_lake_stats():
    api_path = Path(__file__).resolve().parents[1] / "src" / "tqs_intelligence" / "api.py"
    text = api_path.read_text(encoding="utf-8")
    start = text.index("async def _build_audit_payload()")
    end = text.index("@app.get('/api/audit')", start)
    block = text[start:end]
    assert "asyncio.to_thread(lake.quick_stats)" in block
    assert "asyncio.to_thread(lake.verify)" not in block
