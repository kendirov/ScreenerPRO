(()=>{
  const baseRenderCoverage=renderCoverage;
  const baseRenderCharts=renderCharts;

  function metricRows(name){return state.instrument?.metrics?.[name]||[]}
  function sourceRows(provider,name){return state.instrument?.metric_sources?.[provider]?.[name]||[]}
  function lineData(name,mult=1){return metricRows(name).filter(x=>x.ts_ms&&x.value!=null).map(x=>({time:Math.floor(Number(x.ts_ms)/1000),value:Number(x.value)*mult}))}
  function sourceLine(provider,name,mult=1){return sourceRows(provider,name).filter(x=>x.ts_ms&&x.value!=null).map(x=>({time:Math.floor(Number(x.ts_ms)/1000),value:Number(x.value)*mult}))}
  function normalized(rows){if(!rows.length)return[];const first=Number(rows[0].value);if(!Number.isFinite(first)||first===0)return[];return rows.map(x=>({time:x.time,value:Number(x.value)/first*100}))}

  renderCoverage=function(){
    baseRenderCoverage();
    const d=state.instrument,c=d?.coverage||{},box=$('#backfillBox');if(!box)return;
    const hist=[];
    if(c.historical_oi_points)hist.push(`OI: ${compact(c.historical_oi_points)} canonical points`);
    if(c.historical_funding_points)hist.push(`funding: ${compact(c.historical_funding_points)} canonical points`);
    if(c.participant_metric_points)hist.push(`FUTOI: ${compact(c.participant_metric_points)} points`);
    if(c.price_history_is_fallback)hist.push(`price history: ${String(c.price_history_provider||'context').toUpperCase()} context`);
    if(hist.length)box.insertAdjacentHTML('beforeend',`<div class="participantNote">Metric/Data context · ${esc(hist.join(' · '))}</div>`);
    const sources=Object.entries(c.metric_sources||{}).map(([provider,rows])=>`${provider}: ${Object.entries(rows).map(([k,v])=>`${k} ${compact(v)}`).join(', ')}`);
    if(sources.length)box.insertAdjacentHTML('beforeend',`<div class="participantNote">${sources.map(esc).join('<br>')}</div>`);
    const missing=d?.suggested_metric_backfills||[];
    if(missing.length){
      box.insertAdjacentHTML('beforeend',`<div class="participantNote">MAX может дозагрузить: ${esc(missing.map(x=>String(x.provider).toUpperCase()).join(' · '))}. Provider limitations сохраняются в provenance.</div>`);
      const p=missing.find(x=>x.provider==='binance');
      if(p&&!d?.suggested_backfill){
        box.insertAdjacentHTML('beforeend',`<div class="coverageAction"><button id="metricBackfillNow" class="btn small">Дозагрузить Binance candles + derivative context</button></div>`);
        $('#metricBackfillNow').onclick=async()=>{try{const payload={provider:'binance',symbol:p.symbol,market_type:'usdt-futures',interval:'5m',start_ms:p.start_ms};const r=await api('/api/backfill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});toast(`Контекст поставлен в очередь: ${esc(r.title_ru||r.id||'job')}`)}catch(e){toast('Metrics: '+esc(e.message))}};
      }
    }
  };

  renderRelated=function(){
    const rows=(state.instrument?.venue_context||state.instrument?.related||[]).slice(0,40),target=$('#relatedTable');if(!target)return;
    target.innerHTML=rows.length?`<table class="table"><thead><tr><th>Инструмент</th><th>Площадка</th><th>Тип</th><th>Цена</th><th>Δ venue</th><th>24ч</th><th>Funding</th><th>OI</th><th>Оборот</th></tr></thead><tbody>${rows.map(x=>`<tr class="click relatedRow" data-cid="${esc(x.canonical_id)}"><td><b>${esc(x.display_symbol||x.symbol)}</b></td><td>${esc(x.venue||x.provider)}</td><td>${esc(x.market_type)}</td><td>${num(x.last,6)}</td><td class="venueDeviation ${Number(x.venue_deviation_bps)>0?'up':Number(x.venue_deviation_bps)<0?'down':''}">${x.venue_deviation_bps==null?'—':`${Number(x.venue_deviation_bps)>0?'+':''}${num(x.venue_deviation_bps,1)} bp`}</td><td>${pct(x.change_24h_pct)}</td><td>${x.funding_rate==null?'—':pct(Number(x.funding_rate)*100,4)}</td><td>${compact(x.open_interest)}</td><td>${compact(x.turnover_24h)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Экономически связанные инструменты пока не найдены.</div>';
    $$('.relatedRow').forEach(r=>r.onclick=()=>openInstrument(r.dataset.cid));
  };

  function providerBadges(){
    const s=state.instrument?.metric_sources||{},bits=[];
    if(s.binance&&Object.keys(s.binance).length)bits.push('<span class="historyLimit">BINANCE · OI/basis public recent window</span>');
    if(s.bybit&&Object.keys(s.bybit).length)bits.push('<span class="historyLimit">BYBIT · independent OI/funding</span>');
    if(s.moex_futoi&&Object.keys(s.moex_futoi).length)bits.push('<span class="delayPill">MOEX public FUTOI · delayed 15d</span>');
    return bits.join(' ');
  }
  function addMetricPanel(){
    const d=state.instrument;if(!d)return null;
    const hasCrypto=Object.keys(d.metric_sources?.binance||{}).length||Object.keys(d.metric_sources?.bybit||{}).length||['open_interest','funding_rate','basis_rate'].some(k=>metricRows(k).length);
    const hasFutoi=Object.keys(d.metrics||{}).some(k=>k.startsWith('futoi_'));
    if(!hasCrypto&&!hasFutoi)return null;
    $('#metricHistoryPanel')?.remove();
    const html=`<div id="metricHistoryPanel" class="panel" style="margin-top:10px"><div class="panelHead"><div><b>Derivative / participant history</b><small>каждая линия хранит свой provider/source/unit</small></div><div>${providerBadges()}</div></div><div class="panelBody">${hasFutoi?participantSummary():''}<div class="derivativeGrid">${hasCrypto?'<div class="derivativePane"><div class="derivativePaneHead"><b>Open Interest · динамика</b><span>index 100 — provider units не смешиваются</span></div><div id="histOi" class="derivativeChart"></div></div><div class="derivativePane"><div class="derivativePaneHead"><b>Funding</b><span>% · Binance vs Bybit</span></div><div id="histFunding" class="derivativeChart"></div></div><div class="derivativePane"><div class="derivativePaneHead"><b>Basis</b><span>Binance perpetual vs index</span></div><div id="histBasis" class="derivativeChart"></div></div>':''}${hasFutoi?'<div class="derivativePane" style="grid-column:1/-1"><div class="derivativePaneHead"><b>MOEX FUTOI · направленная позиция</b><span class="metricLegend"><span><i class="fiz"></i>физлица</span><span><i class="yur"></i>юрлица</span></span></div><div id="histFutoi" class="derivativeChart"></div></div>':''}</div></div></div>`;
    $('#instrumentWorkspace').insertAdjacentHTML('beforeend',html);return {hasCrypto:!!hasCrypto,hasFutoi};
  }
  function participantSummary(){
    const p=state.instrument?.participant_context||{},val=k=>p[k]?.value,when=p.futoi_fiz_long_contracts?.ts_ms||p.futoi_yur_long_contracts?.ts_ms;
    return `<div class="participantStrip"><div class="participantCell"><span>ФИЗ · LONG / SHORT</span><b><span class="sideLong">${compact(val('futoi_fiz_long_contracts'))}</span> / <span class="sideShort">${compact(val('futoi_fiz_short_contracts'))}</span></b></div><div class="participantCell"><span>ФИЗ · NET</span><b class="${Number(val('futoi_fiz_net_contracts'))>=0?'sideLong':'sideShort'}">${compact(val('futoi_fiz_net_contracts'))}</b></div><div class="participantCell"><span>ЮР · LONG / SHORT</span><b><span class="sideLong">${compact(val('futoi_yur_long_contracts'))}</span> / <span class="sideShort">${compact(val('futoi_yur_short_contracts'))}</span></b></div><div class="participantCell"><span>ЮР · NET</span><b class="${Number(val('futoi_yur_net_contracts'))>=0?'sideLong':'sideShort'}">${compact(val('futoi_yur_net_contracts'))}</b></div></div><div class="participantStrip"><div class="participantCell"><span>ФИЗ лиц LONG</span><b>${compact(val('futoi_fiz_long_accounts'))}</b></div><div class="participantCell"><span>ФИЗ лиц SHORT</span><b>${compact(val('futoi_fiz_short_accounts'))}</b></div><div class="participantCell"><span>ЮР лиц LONG</span><b>${compact(val('futoi_yur_long_accounts'))}</b></div><div class="participantCell"><span>ЮР лиц SHORT</span><b>${compact(val('futoi_yur_short_accounts'))}</b></div></div><div class="participantNote">Последний public FUTOI snapshot: ${ts(when,true)}. Это агрегат по базовому инструменту; public ISS без авторизации задержан на 15 дней.</div>`;
  }
  function multiLine(id,series,precision=null){
    const el=$('#'+id);if(!el)return;const valid=series.filter(x=>x.data.length);if(!valid.length){el.innerHTML='<div class="empty">Ряд пока не загружен.</div>';return}
    const c=chartBase(el,180);for(const x of valid){const opts={color:x.color,lineWidth:2,crosshairMarkerVisible:false,title:x.title};if(precision)opts.priceFormat={type:'price',precision,minMove:10**(-precision)};addSeries(c,'LineSeries',opts).setData(x.data)}c.timeScale().fitContent();
  }
  function futoiChart(){const fiz=lineData('futoi_fiz_net_contracts'),yur=lineData('futoi_yur_net_contracts');multiLine('histFutoi',[{title:'ФИЗ',color:COLORS.green,data:fiz},{title:'ЮР',color:COLORS.red,data:yur}])}
  function renderMetricHistory(){
    const flags=addMetricPanel();if(!flags)return;
    if(flags.hasCrypto){
      const binOi=normalized(sourceLine('binance','open_interest')),bybOi=normalized(sourceLine('bybit','open_interest'));
      multiLine('histOi',[{title:'Binance OI idx',color:COLORS.amber,data:binOi},{title:'Bybit OI idx',color:COLORS.blue,data:bybOi}]);
      multiLine('histFunding',[{title:'Binance funding',color:COLORS.violet,data:sourceLine('binance','funding_rate',100)},{title:'Bybit funding',color:COLORS.green,data:sourceLine('bybit','funding_rate',100)}],5);
      multiLine('histBasis',[{title:'Binance basis %',color:COLORS.blue,data:sourceLine('binance','basis_rate',100)}],4);
    }
    if(flags.hasFutoi)futoiChart();
  }
  renderCharts=function(){baseRenderCharts();const src=state.instrument?.price_history_source;if(src?.fallback){const legend=$('.chartLegend');if(legend)legend.textContent+=` · price context: ${String(src.provider).toUpperCase()}`;}renderMetricHistory()};
})();
