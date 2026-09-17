(()=>{
  const baseRenderInstrument=renderInstrument;

  function lastBefore(rows,target){let best=null;for(const x of rows){if(Number(x.ts_ms)<=target)best=x;else break}return best}
  function returns(candles){
    if(!candles?.length)return {};
    const last=candles[candles.length-1],end=Number(last.ts_ms),close=Number(last.close),windows={m15:15*60_000,h1:3600_000,h4:4*3600_000,h24:24*3600_000,d7:7*86400_000};
    const out={};for(const [k,ms] of Object.entries(windows)){const x=lastBefore(candles,end-ms);out[k]=x&&Number(x.close)?(close/Number(x.close)-1)*100:null}return out;
  }
  function latestMetric(name){const rows=state.instrument?.metrics?.[name]||[];const x=rows.at(-1);return x?{ts_ms:x.ts_ms,value:x.value,unit:x.unit,provider:x.provider,source:x.source}:null}
  function accountAggregate(){
    const rows=matchingPositions?.()||[];let long=0,short=0,longCount=0,shortCount=0;
    for(const p of rows){const n=Math.abs(Number(p.notional||0));if(p.side==='long'){long+=n;longCount++}if(p.side==='short'){short+=n;shortCount++}}
    return {observed_hot_set_accounts:new Set(rows.map(x=>`${x.source}:${x.account_id}`)).size,positions:rows.length,long_notional:long,short_notional:short,long_positions:longCount,short_positions:shortCount,net_notional:long-short,note:'Only currently observed public hot-set positions; not total market positioning.'};
  }
  function redactedFills(){return (state.fills||[]).slice(0,80).map(f=>({ts_ms:f.ts_ms,direction:f.direction||f.side||null,price:f.price,notional:Math.abs(Number(f.qty||0)*Number(f.price||0)),source:f.source||'hyperliquid'}))}
  function compactVenue(x){return {canonical_id:x.canonical_id,provider:x.provider,venue:x.venue,market_type:x.market_type,last:x.last,change_24h_pct:x.change_24h_pct,turnover_24h:x.turnover_24h,open_interest:x.open_interest,funding_rate:x.funding_rate,venue_deviation_bps:x.venue_deviation_bps}}
  function buildPack(){
    const d=state.instrument||{},q=d.quote||{},p=d.participant_context||{},candles=d.candles||[],scores=(d.scores||[]).slice(-40),eps=(d.episodes||[]).slice(-30),news=(d.news||[]).slice(0,30),runs=(d.strategy_runs||[]).slice(0,30);
    return {
      format:'TQS_INSTRUMENT_AI_PACK_V1',created_at_ms:Date.now(),language:'ru',
      role:'Analyze one market instrument using only supplied evidence; distinguish FACT / OBSERVATION / HYPOTHESIS / UNKNOWN.',
      guardrails:[
        'Do not infer causality from timestamp coincidence alone.',
        'Public-account data is an observed subset, not the whole market and not proof of trader motive.',
        'Provider-specific OI/funding/basis series keep their own provenance and may have different units/history limits.',
        'MOEX public FUTOI can be delayed; check point metadata before calling it current.',
        'Do not call a pattern an edge without sufficient N, controls, chronological OOS/walk-forward and realistic costs.'
      ],
      instrument:{canonical_id:d.canonical_id,economic_key:d.economic_key,symbol:q.symbol,display_symbol:q.display_symbol,provider:q.provider,venue:q.venue,market_type:q.market_type,asset_class:q.asset_class},
      current:{price:d.latest_live?.price??q.last,change_24h_pct:q.change_24h_pct,turnover_24h:q.turnover_24h,spread_bps:q.spread_bps,open_interest:d.latest_live?.open_interest??q.open_interest,funding_rate:d.latest_live?.funding_rate??q.funding_rate,observed_at_ms:d.latest_live?.ts_ms??q.observed_at_ms},
      price_context:{returns_pct:returns(candles),history_points:candles.length,history_from_ms:candles[0]?.ts_ms??null,history_to_ms:candles.at(-1)?.ts_ms??null,last_60_candles:candles.slice(-60).map(x=>({ts_ms:x.ts_ms,open:x.open,high:x.high,low:x.low,close:x.close,volume:x.volume,turnover:x.turnover}))},
      derivative_metrics:{binance_or_primary:{open_interest:latestMetric('open_interest'),open_interest_value:latestMetric('open_interest_value'),funding_rate:latestMetric('funding_rate'),basis_rate:latestMetric('basis_rate'),basis:latestMetric('basis'),annualized_basis_rate:latestMetric('annualized_basis_rate')}},
      moex_participants:Object.fromEntries(Object.entries(p).map(([k,v])=>[k,{ts_ms:v.ts_ms,value:v.value,unit:v.unit,provider:v.provider,source:v.source,meta:{delayed:v.meta?.delayed,delay_note:v.meta?.delay_note}}])),
      public_accounts:{aggregate:accountAggregate(),recent_fills:redactedFills()},
      cross_venue:(d.venue_context||[]).slice(0,20).map(compactVenue),
      anomalies:scores.map(x=>({ts_ms:x.ts_ms,score:x.score,severity:x.severity,reasons:x.reasons,signals:x.signals})),
      episodes:eps.map(x=>({episode:x.episode,outcome:x.outcome})),
      news:news.map(x=>({ts_ms:x.published_at_ms||x.ts_ms||x.timestamp,title:x.title||x.headline,source:x.source||x.provider,url:x.url||null})),
      strategy_runs:runs.map(x=>({strategy_id:x.strategy_id,status:x.status,events:x.events,created_at_ms:x.created_at_ms,finished_at_ms:x.finished_at_ms,warnings:x.warnings||[]})),
      coverage:d.coverage,
      requested_analysis:[
        'Describe what is objectively unusual now and what is merely normal market variation.',
        'Compare price, volume, OI, funding/basis and participant/account behavior on aligned timestamps.',
        'List alternative explanations and data-quality limitations before proposing a hypothesis.',
        'Find historical anomaly/episode analogues and say what additional test would discriminate the hypothesis.',
        'Propose reproducible Research/StrategySpec experiments; do not invent a live trade recommendation.'
      ]
    };
  }
  function ensurePanel(){
    if($('#aiPanel'))return;
    document.body.insertAdjacentHTML('beforeend',`<aside id="aiPanel" class="aiPanel"><div class="aiPanelHead"><div><b>AI CONTEXT · инструмент</b><small>компактный evidence-пакет без адресов счетов</small></div><div class="aiActions"><button id="aiCopy" class="btn small">Копировать</button><button id="aiClose" class="btn small ghost">×</button></div></div><div class="aiPanelBody"><div class="aiRule"><b>Назначение:</b> вставь этот JSON в новый ChatGPT-чат. Модель получает факты/контекст, а не сырой market firehose.</div><div id="aiCopied" class="aiCopied"></div><pre id="aiPre" class="aiPre"></pre></div></aside>`);
    $('#aiClose').onclick=()=>$('#aiPanel').classList.remove('show');
    $('#aiCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('#aiPre').textContent);$('#aiCopied').textContent='Скопировано в буфер обмена.';setTimeout(()=>$('#aiCopied').textContent='',2500)}catch(e){$('#aiCopied').textContent='Не удалось скопировать: '+e.message}};
  }
  function openPack(){ensurePanel();const pack=buildPack();$('#aiPre').textContent=JSON.stringify(pack,null,2);$('#aiPanel').classList.add('show')}
  function installBridge(){
    const head=$('.instrumentHeader');if(!head||$('#aiPackBtn'))return;
    const actions=document.createElement('div');actions.className='aiBridge';actions.innerHTML='<button id="aiPackBtn" class="aiBtn">AI ПАКЕТ</button>';head.appendChild(actions);$('#aiPackBtn').onclick=openPack;
  }
  renderInstrument=function(){baseRenderInstrument();installBridge()};
})();
