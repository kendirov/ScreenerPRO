from __future__ import annotations

import pytest

from tqs_intelligence.models import AssetClass
from tqs_intelligence.moex_source import MoexSourceV04, _pct_change


class FakeHttp:
    async def get_json(self, url, params=None):
        return {
            'securities': {
                'columns': ['SECID','SHORTNAME','CURRENCYID','LASTTRADEDATE','LOTSIZE','MINSTEP','PREVPRICE'],
                'data': [['TEST','Тестовый индекс','RUB',None,1,0.01,1000.0]],
            },
            'marketdata': {
                'columns': ['SECID','BOARDID','CURRENTVALUE','CHANGE','LASTCHANGE','LASTCHANGEPRCNT','NUMTRADES','VALUE','TRADINGSTATUS'],
                'data': [['TEST','SNDX',988.0,-184.61,-184.61,-1.2,1234,987654321.0,'T']],
            },
        }


@pytest.mark.asyncio
async def test_index_absolute_change_is_not_used_as_percent():
    source=MoexSourceV04(FakeHttp())
    rows=await source._fetch_market('stock','index',AssetClass.INDEX,'index')
    assert len(rows)==1
    q=rows[0]
    assert q.change_24h_pct == pytest.approx(-1.2)
    assert q.meta['absolute_change'] == pytest.approx(-184.61)
    assert q.meta['pct_source'] == 'explicit_pct'
    assert q.meta['num_trades'] == 1234


def test_percent_can_be_derived_from_previous_price_but_not_change_points():
    pct,source=_pct_change({'CHANGE':-250.0,'LASTCHANGE':-250.0,'PREVPRICE':1000.0},{},990.0)
    assert pct == pytest.approx(-1.0)
    assert source == 'derived_last_vs_prev'


def test_missing_percent_stays_unknown():
    pct,source=_pct_change({'CHANGE':-250.0,'LASTCHANGE':-250.0},{},990.0)
    assert pct is None
    assert source == 'missing_pct'
